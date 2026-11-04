import type { OnlineUser } from "./types";
import { Icon } from "./components/GamePrimitives";

type OnlinePanelProps = {
  users: OnlineUser[];
  myUserId: string;
  isOnline: boolean;
  matching: boolean;
  onInvite: (targetUserId: string, targetName: string) => void;
};

export default function OnlinePanel({
  users,
  myUserId,
  isOnline,
  matching,
  onInvite,
}: OnlinePanelProps) {
  return (
    <div className="online-panel">
      <p className="modal-description">
        Danh sách tất cả người chơi đang kết nối hệ thống trong thời gian thực.
      </p>

      {users.length === 0 ? (
        <div className="modal-empty">
          <Icon name="users" size={36} />
          <h3>Chưa có người chơi trực tuyến.</h3>
          <p>Mở thêm một tab hoặc trình duyệt khác để thử nghiệm thi đấu đối kháng.</p>
        </div>
      ) : (
        <div className="rooms-list" style={{ maxHeight: 380, overflowY: "auto" }}>
          {users.map((u) => {
            const isMe = u.id === myUserId;
            const canInvite = !isMe && u.status === "idle" && !isOnline && !matching;

            let statusLabel = "Đang rỗi";
            let statusColor = "#10b981"; // green
            if (u.status === "matching") {
              statusLabel = "Đang bận (tìm trận)";
              statusColor = "#f59e0b"; // yellow
            } else if (u.status === "playing" || u.status === "waiting") {
              statusLabel = "Đang bận";
              statusColor = "#ef4444"; // red
            }

            return (
              <div
                key={u.id}
                className="room-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  marginBottom: "8px",
                  background: isMe ? "#f0fdf4" : "var(--card-bg, #ffffff)",
                  border: isMe ? "1px solid #86efac" : "1px solid var(--border-color, #e2e8f0)",
                  cursor: canInvite ? "pointer" : "default",
                  transition: "all 0.15s ease",
                }}
                onClick={() => {
                  if (canInvite) onInvite(u.id, u.name);
                }}
                title={canInvite ? `Click để thách đấu với ${u.name}` : undefined}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      backgroundColor: isMe ? "#0284c7" : "#64748b",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 16,
                      textTransform: "uppercase",
                      flexShrink: 0,
                    }}
                  >
                    {u.name ? u.name.charAt(0) : "P"}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong
                        style={{
                          fontSize: 15,
                          cursor: canInvite ? "pointer" : "default",
                          color: canInvite ? "var(--primary, #0284c7)" : "inherit",
                          textDecoration: canInvite ? "underline" : "none",
                        }}
                      >
                        {u.name} {isMe ? " (Bạn)" : ""}
                      </strong>
                      <span
                        style={{
                          display: "inline-block",
                          backgroundColor: "#e0f2fe",
                          color: "#0369a1",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        {u.score ?? 0} đ
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 4 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          backgroundColor: statusColor,
                          display: "inline-block",
                        }}
                      />
                      <span style={{ color: statusColor, fontWeight: 500 }}>{statusLabel}</span>
                    </div>
                  </div>
                </div>

                {!isMe && (
                  <button
                    type="button"
                    className="button primary"
                    style={{ fontSize: 13, padding: "6px 14px", height: "auto" }}
                    disabled={!canInvite}
                    title={
                      isOnline
                        ? "Bạn đang trong phòng chơi"
                        : matching
                        ? "Bạn đang tìm trận"
                        : u.status !== "idle"
                        ? "Người chơi đang bận"
                        : "Gửi lời mời thách đấu"
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canInvite) onInvite(u.id, u.name);
                    }}
                  >
                    Mời đấu
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

