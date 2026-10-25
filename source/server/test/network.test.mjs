import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";

test(
  "HTTP and two real WebSocket clients: room, moves, chat, resume and rematch",
  { timeout: 20000 },
  async (t) => {
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL("../index.mjs", import.meta.url))],
      {
        env: { ...process.env, PORT: "0" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const sockets = [];
    t.after(() => {
      sockets.forEach((s) => s.terminate());
      child.kill();
    });
    const port = await new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(
        () => reject(new Error("Server startup timed out")),
        10000,
      );
      child.stdout.on("data", (data) => {
        output += data;
        const match = output.match(/Local:\s+http:\/\/localhost:(\d+)/);
        if (match) {
          clearTimeout(timer);
          resolve(Number(match[1]));
        }
      });
      child.once("error", reject);
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Server exited ${code}: ${output}`));
      });
      child.stderr.on("data", (data) => {
        output += data;
      });
    });
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).transport, "WebSocket");
    const connectionResponse = await fetch(
      `http://127.0.0.1:${port}/api/connection`,
    );
    assert.equal(connectionResponse.status, 200);
    assert.equal(connectionResponse.headers.get("cache-control"), "no-store");
    assert.ok(Array.isArray((await connectionResponse.json()).origins));

    async function client(token) {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      sockets.push(ws);
      const queue = [];
      ws.on("message", (raw) => queue.push(JSON.parse(raw)));
      function wait(predicate) {
        return new Promise((resolve, reject) => {
          const start = Date.now();
          const timer = setInterval(() => {
            const index = queue.findIndex(predicate);
            if (index >= 0) {
              clearInterval(timer);
              resolve(queue.splice(index, 1)[0]);
            } else if (Date.now() - start > 3000) {
              clearInterval(timer);
              reject(new Error("Expected network message not received"));
            }
          }, 10);
        });
      }
      await new Promise((resolve, reject) => {
        ws.once("open", resolve);
        ws.once("error", reject);
      });
      const send = (value) => ws.send(JSON.stringify(value));
      send({ type: "hello", token });
      const welcome = await wait((m) => m.type === "welcome");
      return { ws, send, wait, welcome };
    }
    const a = await client(),
      b = await client();
    a.send({ type: "create", name: "Network X" });
    const waiting = (await a.wait((m) => m.type === "room")).room;
    assert.equal(waiting.status, "waiting");
    b.send({ type: "join", name: "Network O", roomId: waiting.id });
    await a.wait((m) => m.type === "room" && m.room.status === "playing");
    await b.wait((m) => m.type === "room" && m.room.status === "playing");
    a.send({ type: "move", index: 112 });
    const ar = await a.wait(
      (m) => m.type === "room" && m.room.moves.length === 1,
    );
    const br = await b.wait(
      (m) => m.type === "room" && m.room.moves.length === 1,
    );
    assert.deepEqual(ar.room.board, br.room.board);
    b.send({ type: "move", index: 112 });
    assert.equal((await b.wait((m) => m.type === "error")).type, "error");
    b.send({ type: "chat", text: "Xin chào qua WebSocket!" });
    assert.equal(
      (await a.wait((m) => m.type === "room" && m.room.messages.length === 1))
        .room.messages[0].text,
      "Xin chào qua WebSocket!",
    );
    await new Promise((resolve) => {
      a.ws.once("close", resolve);
      a.ws.close();
    });
    await b.wait((m) => m.type === "room" && m.room.remaining != null);
    const resumed = await client(a.welcome.token);
    assert.equal(resumed.welcome.id, a.welcome.id);
    assert.equal(
      (await resumed.wait((m) => m.type === "room")).room.moves.length,
      1,
    );
    resumed.send({ type: "resign" });
    const finish = await b.wait(
      (m) => m.type === "room" && m.room.status === "finished",
    );
    assert.equal(finish.room.winner, b.welcome.id);
    resumed.send({ type: "rematch" });
    b.send({ type: "rematch" });
    const rematch = await b.wait(
      (m) =>
        m.type === "room" &&
        m.room.status === "playing" &&
        m.room.moves.length === 0 &&
        m.room.round !== waiting.round,
    );
    assert.equal(rematch.room.players[0].id, b.welcome.id);
    b.send({ type: "leave" });
    await b.wait((m) => m.type === "left");
  },
);
