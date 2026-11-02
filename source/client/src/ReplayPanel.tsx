import { useEffect, useState } from "react";
import { emptyBoard, SIZE } from "../../shared/game.mjs";

export type Replay = {
  id: string;
  players: { name: string }[];
  moves: { index: number; symbol: "X" | "O" }[];
  reason: string | null;
};

export default function ReplayPanel({ replay }: { replay: Replay }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { setStep(0); setPlaying(false); }, [replay.id]);
  useEffect(() => {
    if (!playing) return;
    if (step >= replay.moves.length) { setPlaying(false); return; }
    const timer = setTimeout(() => setStep((n) => n + 1), 650);
    return () => clearTimeout(timer);
  }, [playing, step, replay.moves.length]);
  const board = emptyBoard();
  replay.moves.slice(0, step).forEach((move) => { board[move.index] = move.symbol; });
  const current = replay.moves[step - 1];
  return (
    <div className="replay-panel">
      <p className="modal-description">{replay.players[0]?.name || "X"} <span className="replay-versus">VS</span> {replay.players[1]?.name || "O"}</p>
      <div className="replay-board" role="img" aria-label={`Bàn cờ sau ${step} trên ${replay.moves.length} nước đi`}>
        {board.map((stone, index) => <span key={index} className={`replay-cell ${current?.index === index ? "is-current" : ""}`}>
          {stone && <i className={`mark mark-${stone.toLowerCase()}`} aria-label={stone} />}
        </span>)}
      </div>
      <div className="replay-progress"><span>Nước {step} / {replay.moves.length}</span><span>{step ? `${String.fromCharCode(65 + (current!.index % SIZE))}${Math.floor(current!.index / SIZE) + 1} · ${current!.symbol}` : "Bắt đầu"}</span></div>
      <input className="replay-range" type="range" min={0} max={replay.moves.length} value={step} aria-label="Chọn nước đi" onChange={(e) => { setPlaying(false); setStep(Number(e.target.value)); }} />
      <div className="replay-controls">
        <button className="button secondary" onClick={() => { setPlaying(false); setStep(0); }}>Đầu ván</button>
        <button className="button secondary" disabled={step === 0} onClick={() => { setPlaying(false); setStep(step - 1); }}>← Trước</button>
        <button className="button primary" onClick={() => { if (step === replay.moves.length) setStep(0); setPlaying(!playing); }}>{playing ? "Tạm dừng" : "▶ Phát"}</button>
        <button className="button secondary" disabled={step === replay.moves.length} onClick={() => { setPlaying(false); setStep(step + 1); }}>Sau →</button>
      </div>
    </div>
  );
}
