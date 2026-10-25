import { networkInterfaces } from "node:os";

export function normalizePublicUrl(value) {
  if (!value) return null;
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "PUBLIC_URL must be an HTTP(S) origin, e.g. https://caro.example.com",
    );
  }
  return url.origin;
}

export function connectionInfo(
  port,
  publicUrl = null,
  interfaces = networkInterfaces(),
) {
  const origins = [];
  if (publicUrl)
    origins.push({ url: publicUrl, label: "Internet", kind: "public" });
  const entries = Object.entries(interfaces).sort(([a], [b]) => {
    const priority = (name) =>
      /wi-?fi|wireless|wlan/i.test(name)
        ? 0
        : /virtual|vethernet|docker|wsl|vpn/i.test(name)
          ? 2
          : 1;
    return priority(a) - priority(b);
  });
  for (const [name, addresses] of entries) {
    for (const address of addresses || []) {
      if (address.internal || address.family !== "IPv4") continue;
      const parts = address.address.split(".").map(Number);
      if (
        parts.length !== 4 ||
        parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
      )
        continue;
      const [a, b] = parts;
      if (!(
        a === 10 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168)
      ))
        continue;
      const url = `http://${address.address}:${port}`;
      if (!origins.some((origin) => origin.url === url))
        origins.push({ url, label: name, kind: "lan" });
    }
  }
  return { origins };
}

export function allowedOrigin(origin, host, publicUrl) {
  if (!origin) return true; // Native WebSocket clients do not send Origin.
  try {
    const url = new URL(origin);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      (url.host === host || url.origin === publicUrl)
    );
  } catch {
    return false;
  }
}
