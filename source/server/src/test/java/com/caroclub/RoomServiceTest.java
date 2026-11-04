package com.caroclub;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;

class RoomServiceTest {
    private final ObjectMapper json = new ObjectMapper();
    private final FakeHistory history = new FakeHistory();
    private final AtomicLong clock = new AtomicLong(1_000);
    private final RoomService service = new RoomService(history, clock::get);

    private Client connect(String token) {
        Client client = new Client();
        RoomService.Connected connection = service.connect(token, client.events::add, () -> {}, null);
        client.user = connection.user(); client.connectionId = connection.connectionId();
        return client;
    }
    private void send(Client client, String payload) throws Exception {
        service.handle(client.user, json.readTree(payload));
    }
    private JsonNode latest(Client client, String type) {
        for (int i = client.events.size() - 1; i >= 0; i--) {
            JsonNode node = json.valueToTree(client.events.get(i));
            if (type.equals(node.path("type").asText())) return node;
        }
        fail("No event: " + type);
        return null;
    }
    private static class Client {
        RoomService.User user; String connectionId;
        List<Object> events = new ArrayList<>();
    }
    private static class FakeHistory implements HistoryStore {
        Map<String, ProfileSession> profiles = new HashMap<>();
        List<MatchRecord> matches = new ArrayList<>();
        @Override public ProfileSession profile(String token) {
            if (token != null && profiles.containsKey(token)) return profiles.get(token);
            String value = UUID.randomUUID().toString();
            ProfileSession session = new ProfileSession(new Profile(UUID.randomUUID().toString(), "hash", "Người chơi"), value);
            profiles.put(value, session); return session;
        }
        @Override public ProfileSession profileById(String id) {
            return profiles.values().stream().filter(p -> p.profile().id.equals(id)).findFirst().orElseThrow();
        }
        @Override public void rename(ProfileSession profile, String name) { profile.profile().name = name; }
        @Override public void record(MatchRecord match) { matches.add(match); }
        @Override public List<MatchRecord> personal(String id) { return matches.stream().filter(m -> m.players.stream().anyMatch(p -> p.id().equals(id))).toList(); }
        @Override public List<Map<String, Object>> leaderboard() { return List.of(); }
    }

    @Test void finishedGamePersistsMovesAndSendsReplayHistory() throws Exception {
        Client x = connect(null), o = connect(null);
        send(x, "{\"type\":\"create\",\"name\":\"An\"}");
        String room = latest(x, "room").path("room").path("id").asText();
        send(o, "{\"type\":\"join\",\"name\":\"Binh\",\"roomId\":\"" + room + "\"}");
        for (int i = 0; i < 4; i++) {
            send(x, "{\"type\":\"move\",\"index\":" + (100 + i) + "}");
            send(o, "{\"type\":\"move\",\"index\":" + (130 + i) + "}");
        }
        send(x, "{\"type\":\"move\",\"index\":104}");
        JsonNode finished = latest(x, "room").path("room");
        assertEquals("finished", finished.path("status").asText());
        assertEquals("five", finished.path("reason").asText());
        assertEquals(5, finished.path("line").size());
        assertEquals(1, history.matches.size());
        assertEquals(9, history.matches.getFirst().moves.size());
        assertEquals(1, latest(x, "stats").path("history").size());
    }

    @Test void spectatorCannotPlayAndMatchmakingPairsPlayers() throws Exception {
        Client x = connect(null), o = connect(null), spectator = connect(null);
        send(x, "{\"type\":\"match\",\"name\":\"An\"}");
        assertTrue(latest(x, "matchmaking").path("waiting").asBoolean());
        send(o, "{\"type\":\"match\",\"name\":\"Binh\"}");
        String room = latest(x, "room").path("room").path("id").asText();
        assertEquals("playing", latest(o, "room").path("room").path("status").asText());
        send(spectator, "{\"type\":\"spectate\",\"roomId\":\"" + room + "\"}");
        assertEquals(1, latest(spectator, "room").path("room").path("spectators").asInt());
        send(spectator, "{\"type\":\"move\",\"index\":0}");
        assertEquals("error", latest(spectator, "error").path("type").asText());
        assertEquals(0, latest(x, "room").path("room").path("moves").size());
    }

    @Test void reconnectPreservesSessionAndRoom() throws Exception {
        Client x = connect(null), o = connect(null);
        String token = latest(x, "welcome").path("token").asText();
        send(x, "{\"type\":\"create\",\"name\":\"An\"}");
        String room = latest(x, "room").path("room").path("id").asText();
        send(o, "{\"type\":\"join\",\"name\":\"Binh\",\"roomId\":\"" + room + "\"}");
        service.disconnect(x.user, x.connectionId);
        assertTrue(latest(o, "room").path("room").path("deadline").isNull());
        Client rejoined = connect(token);
        assertEquals(latest(x, "welcome").path("id").asText(), latest(rejoined, "welcome").path("id").asText());
        assertEquals(room, latest(rejoined, "room").path("room").path("id").asText());
        assertTrue(latest(o, "room").path("room").path("remaining").isNull());
    }

    @Test void authenticatedSocketUsesAccountProfileAndLogoutRestoresGuestProfile() {
        Client guest = connect(null);
        String sessionToken = latest(guest, "welcome").path("token").asText();
        String guestToken = latest(guest, "welcome").path("profileToken").asText();
        String guestId = latest(guest, "welcome").path("profileId").asText();
        String accountId = history.profile(null).profile().id;
        Client authenticated = new Client();
        service.connect(sessionToken, authenticated.events::add, () -> {}, guestToken, accountId);
        assertEquals(accountId, latest(authenticated, "welcome").path("profileId").asText());
        Client afterLogout = new Client();
        service.connect(sessionToken, afterLogout.events::add, () -> {}, guestToken, null);
        assertEquals(guestId, latest(afterLogout, "welcome").path("profileId").asText());
    }

    @Test void chatIsScopedTruncatedAndRateLimited() throws Exception {
        Client x = connect(null), o = connect(null);
        send(x, "{\"type\":\"create\",\"name\":\"An\"}");
        String room = latest(x, "room").path("room").path("id").asText();
        send(o, "{\"type\":\"join\",\"name\":\"Binh\",\"roomId\":\"" + room + "\"}");
        send(x, "{\"type\":\"chat\",\"text\":\"Xin chao\"}");
        assertEquals("Xin chao", latest(o, "room").path("room").path("messages").get(0).path("text").asText());
        send(x, "{\"type\":\"chat\",\"text\":\"Qua nhanh\"}");
        assertEquals("Bạn đang gửi tin nhắn quá nhanh.", latest(x, "error").path("message").asText());
        clock.addAndGet(501);
        String longText = "a".repeat(301);
        send(x, "{\"type\":\"chat\",\"text\":\"" + longText + "\"}");
        assertEquals(300, latest(o, "room").path("room").path("messages").get(1).path("text").asText().length());
    }

    @Test void timeoutWithNoMovesRulesAsDraw() throws Exception {
        Client x = connect(null), o = connect(null);
        send(x, "{\"type\":\"create\",\"name\":\"An\"}");
        String room = latest(x, "room").path("room").path("id").asText();
        send(o, "{\"type\":\"join\",\"name\":\"Binh\",\"roomId\":\"" + room + "\"}");
        clock.addAndGet(RoomService.TURN_MS + 1);
        service.tick();
        JsonNode finished = latest(o, "room").path("room");
        assertEquals("finished", finished.path("status").asText());
        assertEquals("timeout", finished.path("reason").asText());
        assertTrue(finished.path("winner").isNull() || finished.path("winner").asText().isEmpty());
    }

    @Test void timeoutFinishesTheGameForTheOtherPlayerWhenMovesExist() throws Exception {
        Client x = connect(null), o = connect(null);
        send(x, "{\"type\":\"create\",\"name\":\"An\"}");
        String room = latest(x, "room").path("room").path("id").asText();
        send(o, "{\"type\":\"join\",\"name\":\"Binh\",\"roomId\":\"" + room + "\"}");
        send(x, "{\"type\":\"move\",\"index\":112}");
        clock.addAndGet(RoomService.TURN_MS + 1);
        service.tick();
        JsonNode finished = latest(o, "room").path("room");
        assertEquals("finished", finished.path("status").asText());
        assertEquals("timeout", finished.path("reason").asText());
        assertEquals(x.user.id, finished.path("winner").asText());
    }

    @Test void rematchInvitationRequiresOpponentAcceptanceAndSwapsSides() throws Exception {
        Client x = connect(null), o = connect(null);
        send(x, "{\"type\":\"create\",\"name\":\"An\"}");
        String room = latest(x, "room").path("room").path("id").asText();
        send(o, "{\"type\":\"join\",\"name\":\"Binh\",\"roomId\":\"" + room + "\"}");
        send(x, "{\"type\":\"resign\"}");
        assertEquals("resign", latest(o, "room").path("room").path("reason").asText());
        send(x, "{\"type\":\"rematch\"}");
        JsonNode invitation = latest(x, "room").path("room");
        assertEquals("finished", invitation.path("status").asText());
        assertEquals(x.user.id, invitation.path("rematch").get(0).asText());
        send(o, "{\"type\":\"rematch\"}");
        JsonNode rematch = latest(x, "room").path("room");
        assertEquals("playing", rematch.path("status").asText());
        assertEquals("Binh", rematch.path("players").get(0).path("name").asText());
        assertEquals(0, rematch.path("moves").size());
    }

    @Test void opponentCanDeclineRematchInvitation() throws Exception {
        Client x = connect(null), o = connect(null);
        send(x, "{\"type\":\"create\",\"name\":\"An\"}");
        String room = latest(x, "room").path("room").path("id").asText();
        send(o, "{\"type\":\"join\",\"name\":\"Binh\",\"roomId\":\"" + room + "\"}");
        send(x, "{\"type\":\"resign\"}");
        send(x, "{\"type\":\"rematch\"}");
        send(o, "{\"type\":\"rematchDecline\"}");

        JsonNode declined = latest(x, "room").path("room");
        assertEquals("finished", declined.path("status").asText());
        assertEquals(0, declined.path("rematch").size());
        assertTrue(latest(x, "notice").path("message").asText().contains("từ chối"));
    }

    @Test void matchmakingCanBeCancelled() throws Exception {
        Client x = connect(null), o = connect(null);
        send(x, "{\"type\":\"match\",\"name\":\"An\"}");
        send(x, "{\"type\":\"cancelMatch\"}");
        assertFalse(latest(x, "matchmaking").path("waiting").asBoolean());
        send(o, "{\"type\":\"match\",\"name\":\"Binh\"}");
        assertTrue(latest(o, "matchmaking").path("waiting").asBoolean());
    }

    @Test void directInviteAssignsChallengedPlayerAsXAndChallengerAsO() throws Exception {
        Client challenger = connect(null), challenged = connect(null);
        send(challenger, "{\"type\":\"rename\",\"name\":\"Challenger\"}");
        send(challenged, "{\"type\":\"rename\",\"name\":\"Challenged\"}");

        send(challenger, "{\"type\":\"invite\",\"targetUserId\":\"" + challenged.user.id + "\"}");
        JsonNode inv = latest(challenged, "invitation");
        String invId = inv.path("id").asText();
        assertEquals("Challenger", inv.path("name").asText());

        send(challenged, "{\"type\":\"inviteResponse\",\"invitationId\":\"" + invId + "\",\"accept\":true}");

        JsonNode room = latest(challenged, "room").path("room");
        assertEquals("playing", room.path("status").asText());
        assertEquals("Challenged", room.path("players").get(0).path("name").asText());
        assertEquals("Challenger", room.path("players").get(1).path("name").asText());
    }
}
