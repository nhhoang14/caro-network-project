import test from "node:test";
import assert from "node:assert/strict";
import {
  connectionInfo,
  normalizePublicUrl,
  allowedOrigin,
} from "../connection.mjs";

test("QR origins use private IPv4 addresses, prefer Wi-Fi and omit loopback/IPv6", () => {
  const info = connectionInfo(3001, null, {
    vEthernet: [{ family: "IPv4", address: "172.20.0.1", internal: false }],
    Ethernet: [{ family: "IPv4", address: "10.0.0.2", internal: false }],
    "Wi-Fi": [
      { family: "IPv4", address: "192.168.1.197", internal: false },
      { family: "IPv6", address: "::1", internal: false },
      { family: "IPv4", address: "8.8.8.8", internal: false },
      { family: "IPv4", address: "169.254.0.5", internal: false },
      { family: "IPv4", address: "127.0.0.1", internal: true },
    ],
  });
  assert.deepEqual(
    info.origins.map((item) => item.url),
    [
      "http://192.168.1.197:3001",
      "http://10.0.0.2:3001",
      "http://172.20.0.1:3001",
    ],
  );
  assert.ok(info.origins.every((item) => item.kind === "lan"));
});
test("public URL takes priority and invalid/non-origin URLs are rejected", () => {
  assert.equal(
    normalizePublicUrl("https://caro.example.com/"),
    "https://caro.example.com",
  );
  assert.equal(normalizePublicUrl(undefined), null);
  for (const url of [
    "javascript:alert(1)",
    "ftp://example.com",
    "https://u:p@example.com",
    "https://example.com/path",
    "https://example.com?token=a",
    "https://example.com/#hash",
  ]) {
    assert.throws(() => normalizePublicUrl(url));
  }
  assert.deepEqual(
    connectionInfo(3000, "https://caro.example.com", {}).origins,
    [{ url: "https://caro.example.com", label: "Internet", kind: "public" }],
  );
  assert.deepEqual(connectionInfo(3000, null, {}).origins, []);
});
test("WebSocket accepts same host or configured public origin, rejects unrelated origin", () => {
  assert.equal(
    allowedOrigin("http://192.168.1.197:3001", "192.168.1.197:3001", null),
    true,
  );
  assert.equal(
    allowedOrigin(
      "https://caro.example.com",
      "localhost:3001",
      "https://caro.example.com",
    ),
    true,
  );
  assert.equal(
    allowedOrigin(
      "https://evil.example.com",
      "localhost:3001",
      "https://caro.example.com",
    ),
    false,
  );
  assert.equal(allowedOrigin("null", "localhost:3001", null), false);
  assert.equal(allowedOrigin(undefined, "localhost:3001", null), true);
});
