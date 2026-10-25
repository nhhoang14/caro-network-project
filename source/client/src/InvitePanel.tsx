import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Origin = { url: string; label: string; kind: "lan" | "public" };
const isLoopback = (host: string) =>
  host === "localhost" ||
  host.endsWith(".localhost") ||
  host.startsWith("127.") ||
  host === "[::1]";
const isPrivate = (host: string) =>
  /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(host);

export default function InvitePanel({
  roomId,
  notify,
}: {
  roomId: string;
  notify: (text: string) => void;
}) {
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [selected, setSelected] = useState("");
  const [qr, setQr] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [qrError, setQrError] = useState(false);
  const selectedOrigin = origins.find((item) => item.url === selected);
  const inviteUrl = selected
    ? `${selected}/?room=${encodeURIComponent(roomId)}`
    : "";

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      let found: Origin[] = [];
      try {
        const response = await fetch("/api/connection", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Connection info unavailable");
        const data = await response.json();
        if (Array.isArray(data.origins)) found = data.origins;
      } catch {
        /* Current reachable origin remains usable without metadata. */
      }
      if (controller.signal.aborted) return;
      if (
        !isLoopback(location.hostname) &&
        !found.some((item) => item.url === location.origin)
      ) {
        found.unshift({
          url: location.origin,
          label: "Địa chỉ đang mở",
          kind: isPrivate(location.hostname) ? "lan" : "public",
        });
      }
      setOrigins(found);
      setSelected(found[0]?.url || "");
      setLoaded(true);
    }
    void load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let active = true;
    setQr("");
    setQrError(false);
    if (inviteUrl) {
      QRCode.toDataURL(inviteUrl, {
        width: 224,
        margin: 3,
        errorCorrectionLevel: "M",
        color: { dark: "#34264f", light: "#ffffff" },
      })
        .then((value) => {
          if (active) setQr(value);
        })
        .catch(() => {
          if (active) setQrError(true);
        });
    }
    return () => {
      active = false;
    };
  }, [inviteUrl]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      notify("Đã sao chép link mời dùng được trên điện thoại!");
    } catch {
      notify("Hãy nhấn giữ hoặc chọn đường link bên dưới để sao chép.");
    }
  }

  return (
    <>
      <div className="invite-label">MÃ PHÒNG CỦA BẠN</div>
      <div className="invite-code">
        <strong>{roomId}</strong>
      </div>
      <div className="qr-invite">
        <h3>Quét QR, vào chơi cùng nhau.</h3>
        {qr ? (
          <img
            className="invite-qr"
            src={qr}
            width={152}
            height={152}
            alt={`Mã QR vào phòng ${roomId}`}
          />
        ) : (
          <p className="qr-placeholder" role="status">
            {!loaded
              ? "Đang tìm địa chỉ kết nối…"
              : qrError
                ? "Không tạo được QR. Bạn vẫn có thể dùng link bên dưới."
                : !inviteUrl
                  ? "Chưa tìm thấy IPv4 mạng LAN. Kết nối máy tính với Wi-Fi rồi tải lại trang."
                  : "Đang tạo mã QR…"}
          </p>
        )}
        {origins.length > 1 && (
          <>
            <label htmlFor="invite-origin">Địa chỉ kết nối</label>
            <select
              id="invite-origin"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              {origins.map((item) => (
                <option value={item.url} key={item.url}>
                  {item.label} · {item.url}
                </option>
              ))}
            </select>
          </>
        )}
        {inviteUrl && (
          <>
            <a
              className="invite-url"
              href={inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {inviteUrl}
            </a>
            <p className="qr-help">
              {selectedOrigin?.kind === "lan"
                ? "Điện thoại và máy tính phải cùng Wi-Fi. Quét bằng Camera hoặc Zalo, rồi nhập tên để vào phòng."
                : "Điện thoại mở link Internet này, nhập tên rồi vào phòng. Server và địa chỉ public cần tiếp tục hoạt động."}
            </p>
            <button className="button white full" onClick={copy}>
              Sao chép link mời
            </button>
          </>
        )}
        {selectedOrigin?.kind === "lan" && (
          <p className="qr-network-note">
            Dùng 4G/5G hoặc Wi-Fi khác? Cần hosting hoặc tunnel để có link
            Internet.
          </p>
        )}
      </div>
    </>
  );
}
