import test from "node:test";
import assert from "node:assert/strict";
import { RoomService, TURN_MS, RECONNECT_MS } from "../rooms.mjs";

function setup() {
  let now = 1000;
  const service = new RoomService(() => now);
  function player(token) {
    const messages = [];
    const session = service.connect(
      token,
      (data) => messages.push(structuredClone(data)),
      () => {},
    );
    return { ...session, messages };
  }
  const a = player(),
    b = player();
  service.handle(a.user, { type: "create", name: "An" });
  const id = a.user.roomId;
  service.handle(b.user, { type: "join", name: "Bình", roomId: id });
  return {
    service,
    a,
    b,
    id,
    room: service.rooms.get(id),
    player,
    advance: (n) => {
      now += n;
    },
  };
}

test("joining starts a shared board; rejects third player and invalid moves", () => {
  const { service, a, b, room, player, id } = setup();
  assert.equal(room.status, "playing");
  const c = player();
  service.handle(c.user, { type: "join", name: "Third", roomId: id });
  assert.equal(c.user.roomId, null);
  assert.equal(c.messages.at(-1).type, "error");
  service.handle(b.user, { type: "move", index: 0 });
  assert.equal(room.board[0], null);
  for (const index of [-1, 225, 0.5, "0", null])
    service.handle(a.user, { type: "move", index });
  assert.equal(room.moves.length, 0);
  service.handle(a.user, { type: "move", index: 0 });
  service.handle(b.user, { type: "move", index: 0 });
  assert.equal(room.moves.length, 1);
  assert.equal(room.turn, "O");
  assert.deepEqual(
    a.messages.filter((m) => m.type === "room").at(-1).room.board,
    b.messages.filter((m) => m.type === "room").at(-1).room.board,
  );
});
test("a five wins authoritatively; rematch requires two votes and swaps symbols", () => {
  const { service, a, b, room } = setup();
  for (let i = 0; i < 4; i++) {
    service.handle(a.user, { type: "move", index: i });
    service.handle(b.user, { type: "move", index: 15 + i });
  }
  service.handle(a.user, { type: "move", index: 4 });
  assert.equal(room.winner, a.user.id);
  assert.equal(room.line.length, 5);
  service.handle(b.user, { type: "move", index: 19 });
  assert.equal(room.moves.length, 9);
  service.handle(a.user, { type: "rematch" });
  assert.equal(room.status, "finished");
  service.handle(b.user, { type: "rematch" });
  assert.equal(room.status, "playing");
  assert.equal(room.moves.length, 0);
  assert.equal(room.players[0], b.user);
});
test("deadline checked on move even before the timer tick", () => {
  const { service, a, b, room, advance } = setup();
  advance(TURN_MS);
  service.handle(a.user, { type: "move", index: 112 });
  assert.equal(room.status, "finished");
  assert.equal(room.winner, b.user.id);
  assert.equal(room.reason, "timeout");
  assert.equal(room.moves.length, 0);
});
test("disconnect pauses clock; same token resumes seat and remaining time", () => {
  const { service, a, b, room, advance, player } = setup();
  advance(5000);
  service.disconnect(a.user, a.connectionId);
  assert.equal(room.remaining, 25000);
  assert.equal(room.deadline, null);
  advance(20000);
  service.tick();
  assert.equal(room.status, "playing");
  service.handle(b.user, { type: "move", index: 0 });
  assert.equal(room.moves.length, 0);
  const resumed = player(a.user.token);
  assert.equal(resumed.user.id, a.user.id);
  assert.equal(room.remaining, null);
  assert.equal(room.deadline, 51000);
  service.disconnect(a.user, a.connectionId);
  assert.equal(resumed.user.online, true);
});
test("expired disconnect forfeits and removes abandoned room after all leave", () => {
  const { service, a, b, room, advance } = setup();
  service.disconnect(a.user, a.connectionId);
  advance(RECONNECT_MS);
  service.tick();
  assert.equal(room.status, "finished");
  assert.equal(room.winner, b.user.id);
  assert.equal(a.user.roomId, null);
  assert.equal(room.players.length, 1);
  service.handle(b.user, { type: "leave" });
  assert.equal(service.rooms.size, 0);
});
test("chat scoped to room, capped to 300 characters and throttled", () => {
  const { service, a, b, room, player, advance } = setup();
  const outside = player();
  const before = outside.messages.length;
  service.handle(a.user, { type: "chat", text: "a".repeat(400) });
  assert.equal(room.messages[0].text.length, 300);
  assert.equal(outside.messages.length, before);
  service.handle(a.user, { type: "chat", text: "spam" });
  assert.equal(room.messages.length, 1);
  advance(500);
  service.handle(b.user, { type: "chat", text: "<script>test</script>" });
  assert.equal(room.messages.length, 2);
  assert.equal(room.messages[1].text, "<script>test</script>");
});
test("resignation and explicit leaving finish the game", () => {
  for (const type of ["resign", "leave"]) {
    const { service, a, b, room } = setup();
    service.handle(a.user, { type });
    assert.equal(room.status, "finished");
    assert.equal(room.winner, b.user.id);
  }
});
