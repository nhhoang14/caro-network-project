import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { HistoryStore } from "../history.mjs";
import { RoomService } from "../rooms.mjs";

test("matchmaking pairs users, spectators cannot act, and match history survives restart", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "caro-history-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "history.json");
  let now = 1000;
  const history = new HistoryStore(file);
  const service = new RoomService(() => now, history);
  function client(profileToken) {
    const messages = [];
    const { user, connectionId } = service.connect(null, (message) => messages.push(structuredClone(message)), () => {}, profileToken);
    return { user, connectionId, messages };
  }
  const a = client(), b = client(), viewer = client();
  service.handle(a.user, { type: "match", name: "An" });
  assert.equal(service.queue.size, 1);
  service.handle(b.user, { type: "match", name: "Bình" });
  assert.equal(service.queue.size, 0);
  const room = service.rooms.get(a.user.roomId);
  assert.equal(room.players.length, 2);
  assert.equal(room.status, "playing");
  service.handle(viewer.user, { type: "spectate", roomId: room.id });
  assert.equal(room.spectators.size, 1);
  service.handle(viewer.user, { type: "move", index: 0 });
  service.handle(viewer.user, { type: "chat", text: "hello" });
  service.handle(viewer.user, { type: "resign" });
  assert.equal(room.moves.length, 0);
  assert.equal(room.messages.length, 0);
  assert.equal(room.status, "playing");
  for (let i = 0; i < 4; i++) {
    service.handle(a.user, { type: "move", index: i });
    service.handle(b.user, { type: "move", index: 15 + i });
  }
  service.handle(a.user, { type: "move", index: 4 });
  assert.equal(room.status, "finished");
  assert.equal(history.personal(a.user.profile.id).length, 1);
  assert.equal(history.leaderboard()[0].wins, 1);
  const reopened = new HistoryStore(file);
  assert.equal(reopened.profile(a.user.profile.token).id, a.user.profile.id);
  assert.deepEqual(reopened.personal(a.user.profile.id)[0].moves, room.moves);
  service.handle(viewer.user, { type: "leave" });
  assert.equal(room.spectators.size, 0);
  service.handle(a.user, { type: "rematch" });
  service.handle(b.user, { type: "rematch" });
  assert.equal(room.status, "playing");
  assert.equal(reopened.matches.length, 1);
});

test("matchmaking can be cancelled and disconnected users leave the queue", () => {
  const service = new RoomService();
  const user = service.connect(null, () => {}, () => {});
  service.handle(user.user, { type: "match", name: "An" });
  service.handle(user.user, { type: "cancelMatch" });
  assert.equal(service.queue.size, 0);
  service.handle(user.user, { type: "match", name: "An" });
  service.disconnect(user.user, user.connectionId);
  assert.equal(service.queue.size, 0);
});

test("spectator reconnect does not reset turn clock and room closes when players leave", () => {
  let now = 0;
  const service = new RoomService(() => now);
  const host = service.connect(null, () => {}, () => {});
  const guest = service.connect(null, () => {}, () => {});
  const viewer = service.connect(null, () => {}, () => {});
  service.handle(host.user, { type: "create", name: "An" });
  const room = service.rooms.get(host.user.roomId);
  service.handle(guest.user, { type: "join", name: "Bình", roomId: room.id });
  service.handle(viewer.user, { type: "spectate", roomId: room.id });
  now = 5000;
  service.disconnect(viewer.user, viewer.connectionId);
  const deadline = room.deadline;
  service.connect(viewer.user.token, () => {}, () => {});
  assert.equal(room.deadline, deadline);
  service.handle(host.user, { type: "leave" });
  service.handle(guest.user, { type: "leave" });
  assert.equal(viewer.user.roomId, null);
  assert.equal(service.rooms.size, 0);
});
