package com.caroclub.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Maps in-memory room state to the stable WebSocket response shape. */
final class RoomViewFactory {
    private RoomViewFactory() {}

    static Map<String, Object> map(Object... pairs) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int index = 0; index < pairs.length; index += 2) {
            result.put((String) pairs[index], pairs[index + 1]);
        }
        return result;
    }

    static Map<String, Object> snapshot(RoomService.Room room, long serverTime) {
        List<Map<String, Object>> players = room.finalPlayers != null
                ? room.finalPlayers
                : room.players.stream()
                        .map(player -> map("id", player.id, "name", player.name, "online", player.online()))
                        .toList();
        return map("id", room.id, "round", room.round, "board", room.board, "status", room.status,
                "turn", room.turn, "players", players, "moves", room.moves, "winner", room.winner,
                "line", room.line, "reason", room.reason,
                "deadline", room.remaining != null ? null : room.deadline, "remaining", room.remaining,
                "messages", room.messages, "rematch", new ArrayList<>(room.rematch),
                "drawOfferedBy", room.drawOfferedBy,
                "spectators", room.spectators.size(), "serverTime", serverTime);
    }

    static Map<String, Object> lobbyRoom(RoomService.Room room) {
        return map("id", room.id, "host", room.players.getFirst().name, "count", room.players.size(),
                "status", room.status, "spectators", room.spectators.size());
    }
}
