import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyBoard,
  winningLine,
  chooseBotMove,
  SIZE,
} from "../../shared/game.mjs";

test("detects horizontal, vertical and both diagonal wins at board edges", () => {
  for (const line of [
    [0, 1, 2, 3, 4],
    [0, 15, 30, 45, 60],
    [0, 16, 32, 48, 64],
    [14, 28, 42, 56, 70],
  ]) {
    const board = emptyBoard();
    line.forEach((i) => {
      board[i] = "X";
    });
    assert.deepEqual(new Set(winningLine(board, line[2], "X")), new Set(line));
  }
});
test("does not wrap rows or count four stones as a win", () => {
  const board = emptyBoard();
  [13, 14, 15, 16, 17].forEach((i) => {
    board[i] = "O";
  });
  assert.deepEqual(winningLine(board, 15, "O"), []);
  const four = emptyBoard();
  [0, 1, 2, 3].forEach((i) => {
    four[i] = "X";
  });
  assert.deepEqual(winningLine(four, 2, "X"), []);
});
test("six stones and a five blocked at both ends are winning lines", () => {
  const board = emptyBoard();
  [16, 17, 18, 19, 20].forEach((i) => {
    board[i] = "X";
  });
  board[15] = board[21] = "O";
  assert.equal(winningLine(board, 18, "X").length, 5);
  board[21] = "X";
  assert.equal(winningLine(board, 18, "X").length, 6);
});
test("bot takes a win, blocks a win, returns legal moves without mutating board", () => {
  assert.equal(chooseBotMove(emptyBoard()), 112);
  for (const symbol of ["O", "X"]) {
    const board = emptyBoard();
    [0, 1, 2, 3].forEach((i) => {
      board[i] = symbol;
    });
    const before = [...board];
    assert.equal(chooseBotMove(board), 4);
    assert.deepEqual(board, before);
  }
  const full = Array(SIZE * SIZE).fill("X");
  assert.equal(chooseBotMove(full), -1);
});
