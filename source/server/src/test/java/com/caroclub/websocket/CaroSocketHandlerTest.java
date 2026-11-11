package com.caroclub.websocket;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class CaroSocketHandlerTest {
    @Test void roomEntryCommandsRequireAnAccount() {
        assertTrue(CaroSocketHandler.requiresAccount("create"));
        assertTrue(CaroSocketHandler.requiresAccount("join"));
        assertTrue(CaroSocketHandler.requiresAccount("match"));
        assertTrue(CaroSocketHandler.requiresAccount("cancelMatch"));
        assertTrue(CaroSocketHandler.requiresAccount("invite"));
        assertTrue(CaroSocketHandler.requiresAccount("inviteResponse"));
        assertTrue(CaroSocketHandler.requiresAccount("spectate"));
    }

    @Test void inRoomAndReadOnlyCommandsDoNotRepeatTheEntryCheck() {
        assertFalse(CaroSocketHandler.requiresAccount("move"));
        assertFalse(CaroSocketHandler.requiresAccount("chat"));
        assertFalse(CaroSocketHandler.requiresAccount("leave"));
        assertFalse(CaroSocketHandler.requiresAccount("stats"));
    }
}
