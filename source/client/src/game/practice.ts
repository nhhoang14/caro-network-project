import { emptyBoard, winningLine, SIZE } from "../../../shared/game.mjs";
import type { Room } from "../types";

export function createPracticeRoom(name: string): Room {
  return {
    id: "practice",
    round: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    board: emptyBoard(),
    status: "playing",
    turn: "X",
    players: [
      { id: "you", name: name || "Bạn", online: true },
      { id: "bot", name: "Caro Bot", online: true },
    ],
    moves: [],
    winner: null,
    line: [],
    reason: null,
    deadline: null,
    remaining: null,
    messages: [],
    rematch: [],
  };
}

export function applyLocalMove(
  current: Room,
  index: number,
  symbol: "X" | "O",
  playerId: string,
): Room {
  if (index < 0 || current.board[index]) return current;
  const board = [...current.board];
  board[index] = symbol;
  const moves = [...current.moves, { index, symbol }];
  const line = winningLine(board, index, symbol);
  const finished = Boolean(line.length) || moves.length === SIZE * SIZE;
  return {
    ...current,
    board,
    moves,
    line,
    turn: symbol === "X" ? "O" : "X",
    status: finished ? "finished" : "playing",
    winner: line.length ? playerId : null,
    reason: finished ? (line.length ? "five" : "draw") : null,
  };
}
