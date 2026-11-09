package com.caroclub.service;

import java.util.LinkedHashSet;
import java.util.Set;

/** Keeps queue policy out of the room/game command handler. */
final class MatchmakingQueue {
    private final Set<RoomService.User> waiting = new LinkedHashSet<>();

    boolean contains(RoomService.User user) { return waiting.contains(user); }
    boolean remove(RoomService.User user) { return waiting.remove(user); }
    void add(RoomService.User user) { waiting.add(user); }
    int size() { return waiting.size(); }

    RoomService.User findOpponent(RoomService.User user) {
        return waiting.stream()
                .filter(candidate -> candidate.online
                        && !candidate.id.equals(user.id)
                        && candidate.roomId == null
                        && !candidate.profile.profile().id.equals(user.profile.profile().id))
                .findFirst()
                .orElse(null);
    }
}
