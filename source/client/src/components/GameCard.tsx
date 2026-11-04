import type { KeyboardEvent } from "react";
import type { Room } from "../types";
import { Icon, Mark } from "./GamePrimitives";

type GameCardProps = {
  room: Room;
  isOnline: boolean;
  isSpectator: boolean;
  isTurn: boolean;
  statusText: string;
  roomSubtext: string;
  focusIndex: number;
  me: string;
  waiting: boolean;
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
};

const STAR_CELLS = new Set([48, 56, 112, 168, 176]);

export default function GameCard({
  room,
  isOnline,
  isSpectator,
  isTurn,
  statusText,
  roomSubtext,
  focusIndex,
  me,
  waiting,
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
    <section className="game-card">
      <div className="game-card-header">
        <div className="status-meta">
          <span className="status-label">{isOnline ? "Phòng đấu" : "Bàn cờ luyện tập"}</span>
          <span className="status-subtext">{roomSubtext}</span>
        </div>
        <div className="turn-indicator">
          {waiting ? (
            <span className="wait-pill">Chờ đối thủ</span>
          ) : room.status === "playing" ? (
            <span className={`turn-pill ${isTurn ? "active" : ""}`}>
              <Mark symbol={room.turn} small />
              {isTurn ? "Lượt của bạn" : `Lượt của ${room.turn}`}
            </span>
          ) : (
            <span className="finish-pill">{resultText}</span>
          )}
          {room.status === "playing" && (
            <span className={`clock-pill ${remaining <= 5 ? "urgent" : ""}`}>
              <Icon name="clock" size={14} />
              {remaining}s
            </span>
          )}
        </div>
      </div>

      <div className="players-bar">
        {room.players.map((player, index) => {
          const symbol = index === 0 ? "X" : "O";
          const isPlayerTurn = room.status === "playing" && room.turn === symbol;
          const isMe = isOnline && player.id === me;
          const isOpponent = isOnline && !isSpectator && !isMe;
          const showOffline = isOnline && isOpponent && !player.online;

          return (
            <div
              key={player.id}
              className={`player-chip ${isPlayerTurn ? "turn" : ""} ${showOffline ? "offline" : ""}`}
            >
              <Mark symbol={symbol} />
              <div className="chip-meta">
                <span className="chip-name">
                  {player.name}
                  {isMe ? " (Bạn)" : ""}
                </span>
                <span className="chip-role">
                  {showOffline ? "Mất kết nối…" : `Quân ${symbol}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="board-wrap"
        role="region"
        aria-label="Bàn cờ Caro 15x15"
      >
        <div
          className="board-grid"
          role="grid"
          aria-readonly={!canMove}
        >
          {room.board.map((cell, index) => {
            const isWinning = room.line.includes(index);
            const isLast = lastMove === index;
            const isFocused = focusIndex === index;
            const row = Math.floor(index / 15) + 1;
            const col = (index % 15) + 1;
            const isStar = STAR_CELLS.has(index);

            return (
              <button
                key={index}
                type="button"
                role="gridcell"
                tabIndex={isFocused ? 0 : -1}
                aria-label={`Ô hàng ${row}, cột ${col}${cell ? `, quân ${cell}` : ", trống"}`}
                disabled={!canMove || Boolean(cell)}
                className={`board-cell ${cell ? "filled" : ""} ${isWinning ? "win" : ""} ${isLast ? "last" : ""} ${isStar ? "star" : ""}`}
                onClick={() => onMove(index)}
                onKeyDown={(event) => onBoardKeyDown(event, index)}
              >
                {cell && <Mark symbol={cell} />}
              </button>
            );
          })}
        </div>
      </div>

      {room.status === "finished" && (
        <div className="game-card-footer" role="status" aria-live="polite">
          <div className="finish-message">
            <strong>{resultText}</strong>
            <p>{reasonText}</p>
          </div>
          {!isSpectator && !opponentRequestedRematch && (
            <button className="button primary" disabled={isOnline && rematchRequested} onClick={onPlayAgain}>
              {isOnline
                ? rematchRequested
                  ? "Đã gửi lời mời…"
                  : "Chơi lại"
                : "Ván mới"}
            </button>
          )}
          {opponentRequestedRematch && (
            <div className="rematch-response" role="group" aria-label="Phản hồi lời mời chơi lại">
              <span>{rematchRequesterName || "Đối thủ"} mời bạn chơi lại</span>
              <button className="button secondary" onClick={onDeclineRematch}>Từ chối</button>
              <button className="button primary" onClick={onPlayAgain}>Đồng ý</button>
            </div>
          )}
          {isOnline && !isSpectator && rematchRequested && (
            <p className="rematch-hint">
              Đang đợi đối thủ đồng ý để bắt đầu ván mới.
            </p>
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
        {isOnline && !isSpectator && room.status === "playing" && onDrawOffer && (
          <button className="text-button" disabled={room.drawOfferedBy === me} onClick={onDrawOffer}>
            <Icon name="handshake" size={17} /> {room.drawOfferedBy === me ? "Đang chờ hòa…" : "Xin hòa"}
          </button>
        )}
        <button className="text-button resign" disabled={room.status !== "playing" || isSpectator} onClick={onResign}>
          <Icon name="flag" size={17} /> Đầu hàng
        </button>
      </div>
    </section>
  );
}
