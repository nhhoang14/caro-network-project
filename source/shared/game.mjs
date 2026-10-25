export const SIZE = 15;
export const emptyBoard = () => Array(SIZE * SIZE).fill(null);

/** Five or more consecutive stones win, including lines blocked at both ends. */
export function winningLine(board, index, symbol) {
  const row = Math.floor(index / SIZE),
    col = index % SIZE;
  for (const [dr, dc] of [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ]) {
    const line = [index];
    for (const direction of [-1, 1]) {
      let r = row + dr * direction,
        c = col + dc * direction;
      while (
        r >= 0 &&
        r < SIZE &&
        c >= 0 &&
        c < SIZE &&
        board[r * SIZE + c] === symbol
      ) {
        line.push(r * SIZE + c);
        r += dr * direction;
        c += dc * direction;
      }
    }
    if (line.length >= 5) return line;
  }
  return [];
}

/** A lightweight practice opponent: win, block, then develop nearby lines. */
export function chooseBotMove(board, symbol = "O") {
  const opponent = symbol === "X" ? "O" : "X";
  const available = board.flatMap((cell, i) => (cell ? [] : [i]));
  if (available.length === SIZE * SIZE) return Math.floor((SIZE * SIZE) / 2);
  if (!available.length) return -1;
  for (const side of [symbol, opponent]) {
    for (const i of available) {
      board[i] = side;
      const wins = winningLine(board, i, side).length > 0;
      board[i] = null;
      if (wins) return i;
    }
  }
  let best = -Infinity,
    choice = available[0];
  for (const i of available) {
    const row = Math.floor(i / SIZE),
      col = i % SIZE;
    let score = 7 - Math.max(Math.abs(row - 7), Math.abs(col - 7));
    for (const side of [symbol, opponent]) {
      for (const [dr, dc] of [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, -1],
      ]) {
        let count = 0,
          open = 0;
        for (const dir of [-1, 1]) {
          let r = row + dr * dir,
            c = col + dc * dir;
          while (
            r >= 0 &&
            r < SIZE &&
            c >= 0 &&
            c < SIZE &&
            board[r * SIZE + c] === side
          ) {
            count++;
            r += dr * dir;
            c += dc * dir;
          }
          if (r >= 0 && r < SIZE && c >= 0 && c < SIZE && !board[r * SIZE + c])
            open++;
        }
        if (open) score += 10 ** count * open * (side === symbol ? 1.1 : 1);
      }
    }
    if (score > best) {
      best = score;
      choice = i;
    }
  }
  return choice;
}
