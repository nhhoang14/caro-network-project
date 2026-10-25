import http from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { RoomService } from "./rooms.mjs";
import {
  connectionInfo,
  normalizePublicUrl,
  allowedOrigin,
} from "./connection.mjs";

const sourceRoot = fileURLToPath(new URL("../", import.meta.url));
const dist = path.join(sourceRoot, "client", "dist");
const dev = process.argv.includes("--dev");
const port = Number(process.env.PORT || 3000);
const publicUrl = normalizePublicUrl(process.env.PUBLIC_URL);
const service = new RoomService();
let vite;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  if (req.url?.split("?")[0] === "/api/connection") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(connectionInfo(server.address().port, publicUrl)));
    return;
  }
  if (req.url?.split("?")[0] === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        rooms: service.rooms.size,
        transport: "WebSocket",
      }),
    );
    return;
  }
  if (vite)
    return vite.middlewares(req, res, () => {
      res.statusCode = 404;
      res.end("Not found");
    });
  try {
    const url = new URL(req.url, "http://localhost");
    const target = path.resolve(dist, "." + decodeURIComponent(url.pathname));
    if (target !== dist && !target.startsWith(dist + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    let file = target;
    try {
      if (!(await stat(file)).isFile()) file = path.join(dist, "index.html");
    } catch {
      file = path.join(dist, "index.html");
    }
    if (!existsSync(file)) {
      res.writeHead(503);
      res.end("Run npm run build before npm start.");
      return;
    }
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    createReadStream(file)
      .on("error", () => res.destroy())
      .pipe(res);
  } catch {
    res.writeHead(400);
    res.end("Bad request");
  }
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
server.on("upgrade", (req, socket, head) => {
  if (req.url !== "/ws") {
    if (!dev) socket.destroy();
    return;
  }
  // An explicitly configured public origin also works behind a reverse proxy.
  if (!allowedOrigin(req.headers.origin, req.headers.host, publicUrl)) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
});

wss.on("connection", (ws) => {
  let session;
  let windowStart = Date.now(),
    count = 0;
  ws.alive = true;
  ws.on("pong", () => {
    ws.alive = true;
  });
  const helloTimeout = setTimeout(() => {
    if (!session) ws.close(1008, "Hello required");
  }, 5000);
  const send = (data) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
  };
  ws.on("message", (raw) => {
    try {
      if (Date.now() - windowStart > 1000) {
        windowStart = Date.now();
        count = 0;
      }
      if (++count > 30) {
        ws.close(1008, "Rate limit");
        return;
      }
      const data = JSON.parse(raw.toString());
      if (!session) {
        if (data?.type !== "hello") {
          ws.close(1008, "Hello required");
          return;
        }
        session = service.connect(data.token, send, () =>
          ws.close(4001, "Session opened elsewhere"),
        );
        clearTimeout(helloTimeout);
      } else service.handle(session.user, data);
    } catch (error) {
      send({
        type: "error",
        message:
          error instanceof SyntaxError
            ? "JSON không hợp lệ."
            : "Không thể xử lý yêu cầu.",
      });
    }
  });
  ws.on("error", () => {});
  ws.on("close", () => {
    clearTimeout(helloTimeout);
    if (session) service.disconnect(session.user, session.connectionId);
  });
});

const tick = setInterval(() => service.tick(), 250);
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.alive) return ws.terminate();
    ws.alive = false;
    ws.ping();
  });
}, 15_000);

if (dev) {
  const { createServer } = await import("vite");
  vite = await createServer({
    configFile: path.join(sourceRoot, "client", "vite.config.ts"),
    server: { middlewareMode: true, hmr: { server, path: "/vite-hmr" } },
  });
}
server.listen(port, "0.0.0.0", () => {
  const actualPort = server.address().port;
  console.log(
    `\n  CARO CLUB  ·  ${dev ? "development" : "demo"}\n  Local:   http://localhost:${actualPort}\n  LAN:     http://<your-ip>:${actualPort}\n`,
  );
  for (const origin of connectionInfo(actualPort, publicUrl).origins) {
    console.log(`  ${origin.label}: ${origin.url}`);
  }
});
server.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
async function shutdown() {
  clearInterval(tick);
  clearInterval(heartbeat);
  wss.clients.forEach((ws) => ws.close(1001, "Server stopping"));
  await vite?.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
