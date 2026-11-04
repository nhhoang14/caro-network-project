import type { KeyboardEvent } from "react";
import { SIZE } from "../../../shared/game.mjs";
import type { Room } from "../types";
import { Icon, Mark } from "./GamePrimitives";

type GameCardProps = {
  room: Room;
  isOnline: boolean;
  isSpectator: boolean;
  me: string;
  displayName: string;
  paused: boolean;
  myTurn: boolean;
  canMove: boolean;
  remaining: number;
  mySymbol: "X" | "O";
  resultText: string;
  reasonText: string;
  sound: boolean;
  onMove: (index: number) => void;
  onBoardKeyDown: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void;
  onPlayAgain: () => void;
  onDeclineRematch: () => void;
  onReplay: () => void;
  onUndo: () => void;
  onToggleSound: () => void;
  onResign: () => void;
  onDrawOffer?: () => void;
  onLeave?: () => void;
};

const STAR_CELLS = new Set([48, 56, 112, 168, 176]);

export default function GameCard({
  room,
  isOnline,
  isSpectator,
  me,
  displayName,
  paused,
  myTurn,
  canMove,
  remaining,
  mySymbol,
  resultText,
  reasonText,
  sound,
  onMove,
  onBoardKeyDown,
  onPlayAgain,
  onDeclineRematch,
  onReplay,
  onUndo,
  onToggleSound,
  onResign,
  onDrawOffer,
  onLeave,
}: GameCardProps) {
  const lastMove = room.moves.at(-1)?.index;
  const rematchRequested = room.rematch.includes(me);
  const rematchRequester = room.rematch.length === 1 ? room.rematch[0] : null;
  const opponentRequestedRematch = Boolean(
    isOnline && rematchRequester && rematchRequester !== me,
  );
  const rematchRequesterName = room.players.find(
    (player) => player.id === rematchRequester,
  )?.name;

  return (
    <section className="game-card" aria-label="Khu vực chơi cờ">
      <div className="game-card-top">
        <div className="board-title">
          <span className="section-icon"><Icon name="grid" size={19} /></span>
          <div>
            <h2>Bàn cờ của bạn</h2>
            <span>{isOnline ? `PHÒNG #${room.id}` : "MỘT VÁN NHẸ NHÀNG, MỘT NGÀY THẬT VUI"}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={`mode-badge ${isOnline ? "online-mode" : ""}`}>
            <Icon name={isOnline ? "link" : "bot"} size={15} />
            {isSpectator ? "Đang xem" : isOnline ? "Đấu online" : "Đấu với máy"}
          </span>
          {isOnline && onLeave && (
            <button
              type="button"
              className="button secondary"
              style={{ fontSize: 13, padding: "5px 12px", height: "auto" }}
              onClick={onLeave}
              title="Thoát khỏi bàn cờ"
            >
              <Icon name="exit" size={14} /> Thoát
            </button>
          )}
        </div>
      </div>

      <div className="player-strip">
        {[0, 1].map((index) => {
          const player = room.players[index];
          const symbol = index === 0 ? "X" : "O";
          return (
            <div key={index} className={`player ${room.turn === symbol && room.status === "playing" ? "current" : ""}`}>
              <div className={`player-avatar ${index === 1 ? "teal" : ""}`}>
                {player?.id === "bot" ? <Icon name="bot" size={23} /> : (player?.name || "?").charAt(0).toUpperCase()}
                <span className={player?.online ? "online-dot" : "offline-dot"} />
              </div>
              <div className="player-info">
                <strong>
                  {player?.id === me ? displayName || "Bạn" : player?.name || "Đang chờ đối thủ"}
                  {player?.id === me && <small> BẠN</small>}
                </strong>
                <span>
                  {!player
                    ? "Mời một người bạn tham gia"
                    : !player.online
                      ? "Đang mất kết nối"
                      : room.status === "finished"
                        ? room.winner === player.id ? "Người chiến thắng" : "Đã kết thúc"
                        : room.turn === symbol
                          ? index === 1 && !isOnline ? "Đang suy nghĩ…" : "Đang đến lượt"
                          : "Sẵn sàng"}
                </span>
              </div>
              <Mark symbol={symbol} small />
            </div>
          );
        })}
        <span className="versus">VS</span>
      </div>

      <div className={`turn-bar ${paused ? "warning" : ""}`} role="status">
        <span className="turn-description">
          <span className="pulse-dot" />
          {room.status === "waiting"
            ? "Phòng đã sẵn sàng. Mời bạn bè vào chơi!"
            : room.status === "finished"
              ? resultText
              : isSpectator
                ? `Đang xem trực tiếp · ${room.spectators || 0} khán giả`
                : paused
                  ? "Tạm dừng · chờ đối thủ kết nối lại (30 giây)"
                  : myTurn
                    ? "Đến lượt bạn. Nước đi tiếp theo là gì?"
                    : isOnline ? "Đối thủ đang suy nghĩ…" : "Caro Bot đang suy nghĩ…"}
        </span>
        <span className={`timer ${isOnline && remaining <= 10 ? "urgent" : ""}`}>
          <Icon name="clock" size={15} />
          {room.status === "finished"
            ? "Đã kết thúc"
            : room.status === "waiting"
              ? "Chờ đối thủ"
              : isOnline ? `${remaining}s` : "Không giới hạn"}
        </span>
      </div>

      <div className="board-area">
        <div className="board-coordinate-top">
          <span />
          {Array.from({ length: SIZE }, (_, index) => <span key={index}>{String.fromCharCode(65 + index)}</span>)}
        </div>
        <div className="board-with-labels">
          <div className="board-coordinate-side">
            {Array.from({ length: SIZE }, (_, index) => <span key={index}>{index + 1}</span>)}
          </div>
          <div className={`board ${canMove ? "playable" : ""}`} role="group" aria-label="Bàn cờ 15 hàng, 15 cột. Dùng phím mũi tên để di chuyển, Enter để đánh.">
            {room.board.map((stone, index) => (
              <button
                key={index}
                data-cell={index}
                tabIndex={index === (lastMove ?? 112) ? 0 : -1}
                aria-label={`${String.fromCharCode(65 + (index % SIZE))}${Math.floor(index / SIZE) + 1}${stone ? `: ${stone}` : ": trống"}`}
                aria-disabled={Boolean(stone) || !canMove}
                className={`cell ${stone ? "occupied" : ""} ${room.line.includes(index) ? "winning" : ""} ${lastMove === index ? "last-move" : ""} ${index === 112 && !room.moves.length ? "center-cell" : ""}`}
                onClick={() => onMove(index)}
                onKeyDown={(event) => onBoardKeyDown(event, index)}
              >
                {stone ? <Mark symbol={stone} /> : <span className={`ghost ghost-${mySymbol.toLowerCase()}`} />}
                {STAR_CELLS.has(index) && !stone && <span className="board-star" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {room.status === "finished" && (
        <div className="result-panel">
          <span className="result-icon"><Icon name="trophy" size={25} /></span>
          <div><strong>{resultText}</strong><p>{reasonText}</p></div>
          {!isSpectator && !opponentRequestedRematch && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className="button primary" disabled={isOnline && rematchRequested} onClick={onPlayAgain}>
                <Icon name="undo" size={16} />
                {!isOnline
                  ? "Chơi lại"
                  : rematchRequested
                    ? "Đang chờ xác nhận…"
                    : "Mời chơi lại"}
              </button>
              {isOnline && onLeave && (
                <button type="button" className="button secondary" onClick={onLeave}>
                  <Icon name="exit" size={16} /> Thoát
                </button>
              )}
            </div>
          )}
          {opponentRequestedRematch && (
            <div className="rematch-response" role="group" aria-label="Phản hồi lời mời chơi lại">
              <span>{rematchRequesterName || "Đối thủ"} mời bạn chơi lại</span>
              <button className="button secondary" onClick={onDeclineRematch}>Từ chối</button>
              <button className="button primary" onClick={onPlayAgain}>Đồng ý</button>
            </div>
          )}
          {isOnline && !isSpectator && rematchRequested && (
            <small>Lời mời đã được gửi. Ván mới chỉ bắt đầu khi đối thủ đồng ý.</small>
          )}
        </div>
      )}

      <div className="board-bottom">
        <span><span className="tiny-dot" />{room.moves.length.toString().padStart(2, "0")} nước đi</span>
        <span>15 × 15 <i /> 5 quân liên tiếp</span>
        <button className="icon-button" title={sound ? "Tắt âm thanh" : "Bật âm thanh"} aria-label={sound ? "Tắt âm thanh" : "Bật âm thanh"} onClick={onToggleSound}>
          <Icon name={sound ? "volume" : "mute"} size={18} />
        </button>
      </div>
      <div className="game-actions">
        <button className="text-button" disabled={!room.moves.length || (isOnline && room.status !== "finished")} onClick={onReplay}>
          <Icon name="history" size={17} /> Xem lại ván
        </button>
        <button className="text-button" disabled={isOnline || !room.moves.length || room.status === "finished"} onClick={onUndo}>
          <Icon name="undo" size={17} /> Đi lại
        </button>
        {isOnline && !isSpectator && room.status === "playing" && onDrawOffer && (
          <button className="text-button" disabled={room.drawOfferedBy === me} onClick={onDrawOffer}>
            <Icon name="handshake" size={17} /> {room.drawOfferedBy === me ? "Đang chờ hòa…" : "Xin hòa"}
          </button>
        )}
        <span className="action-note">{isOnline ? "Nước đi được xác nhận bởi server" : "Thử chiến thuật, tự tin hơn mỗi ván"}</span>
        <button className="text-button resign" disabled={room.status !== "playing" || isSpectator} onClick={onResign}>
          <Icon name="flag" size={17} /> Đầu hàng
        </button>
      </div>
    </section>
  );
}
