export const SIZE: number;
export type Stone = "X" | "O" | null;
export function emptyBoard(): Stone[];
export function winningLine(
  board: Stone[],
  index: number,
  symbol: "X" | "O",
): number[];
export function chooseBotMove(board: Stone[], symbol?: "X" | "O"): number;
