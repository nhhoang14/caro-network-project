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

            let statusLabel = "Đang rảnh";
            let statusColor = "#10b981"; // green
            if (u.status === "matching") {
              statusLabel = "Đang tìm trận";
              statusColor = "#f59e0b"; // yellow
            } else if (u.status === "playing" || u.status === "waiting") {
              statusLabel = "Đang trong phòng";
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
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      backgroundColor: isMe ? "#0284c7" : "#64748b",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 16,
                      textTransform: "uppercase",
                    }}
                  >
                    {u.name ? u.name.charAt(0) : "P"}
                  </div>
                  <div>
                    <strong style={{ fontSize: 15, display: "block" }}>
                      {u.name} {isMe ? " (Bạn)" : ""}
                    </strong>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 2 }}>
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
                    onClick={() => onInvite(u.id, u.name)}
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

