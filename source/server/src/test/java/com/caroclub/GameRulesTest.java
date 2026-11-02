package com.caroclub;

import static org.junit.jupiter.api.Assertions.*;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;

class GameRulesTest {
    @Test void winsAlongFourAxesIncludingBlockedEnds() {
        for (int step : new int[] {1, 15, 16, 14}) {
            List<String> board = new ArrayList<>(Collections.nCopies(225, null));
            int start = 7 * 15 + 7;
            for (int n = 0; n < 5; n++) board.set(start + n * step, "X");
            assertEquals(5, GameRules.winningLine(board, start + 4 * step, "X").size());
        }
    }
    @Test void fourStonesDoNotWin() {
        List<String> board = new ArrayList<>(Collections.nCopies(225, null));
        for (int n = 0; n < 4; n++) board.set(100 + n, "O");
        assertTrue(GameRules.winningLine(board, 103, "O").isEmpty());
    }
}
