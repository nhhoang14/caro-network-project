package com.caroclub;

import java.util.ArrayList;
import java.util.List;

public final class GameRules {
    public static final int SIZE = 15;
    private GameRules() {}

    public static List<Integer> winningLine(List<String> board, int index, String symbol) {
        int row = index / SIZE, col = index % SIZE;
        for (int[] axis : new int[][] {{0, 1}, {1, 0}, {1, 1}, {1, -1}}) {
            List<Integer> line = new ArrayList<>();
            line.add(index);
            for (int direction : new int[] {-1, 1}) {
                int r = row + axis[0] * direction, c = col + axis[1] * direction;
                while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && symbol.equals(board.get(r * SIZE + c))) {
                    line.add(r * SIZE + c);
                    r += axis[0] * direction;
                    c += axis[1] * direction;
                }
            }
            if (line.size() >= 5) return line;
        }
        return List.of();
    }
}
