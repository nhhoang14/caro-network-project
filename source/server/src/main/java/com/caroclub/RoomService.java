package com.caroclub;

import static com.caroclub.RoomViewFactory.map;

import com.fasterxml.jackson.databind.JsonNode;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.function.LongSupplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class RoomService {
    public static final long TURN_MS = 15_000, RECONNECT_MS = 30_000;
    private final HistoryStore history;
    private final LongSupplier clock;
    private final SecureRandom random = new SecureRandom();
    private final Map<String, User> sessions = new LinkedHashMap<>();
    private final Map<String, Room> rooms = new LinkedHashMap<>();
    private final MatchmakingQueue queue = new MatchmakingQueue();
    private final Map<String, Invitation> invitations = new ConcurrentHashMap<>();

    @Autowired
    public RoomService(HistoryStore history) { this(history, System::currentTimeMillis); }
    RoomService(HistoryStore history, LongSupplier clock) {
        this.history = history;
        this.clock = clock;
    }
    private long now() { return clock.getAsLong(); }

    public record Connected(User user, String connectionId) {}
    public static final class User {
        String id = UUID.randomUUID().toString(), token, name = "Người chơi", roomId, role, connectionId;
        HistoryStore.ProfileSession profile;
        String accountProfileId;
        Consumer<Object> send;
        Runnable close;
        boolean online;
        long lastSeen, lastChat = -1;
    }
    static final class Room {
        String id, round = UUID.randomUUID().toString(), turn = "X", status = "waiting", winner, reason;
        List<User> players = new ArrayList<>();
        Set<User> spectators = new LinkedHashSet<>();
        List<String> board = new ArrayList<>(Collections.nCopies(225, null));
        List<MatchRecord.Move> moves = new ArrayList<>();
        List<Integer> line = List.of();
        Long deadline, remaining;
        List<Map<String, Object>> messages = new ArrayList<>();
        Set<String> rematch = new LinkedHashSet<>();
        String drawOfferedBy;
        List<Map<String, Object>> finalPlayers;
    }
    static final class Invitation {
        String id = UUID.randomUUID().toString();
        User from;
        User to;
        long expiresAt;
    }

    private String randomToken() {
        byte[] bytes = new byte[24]; random.nextBytes(bytes);
        return java.util.HexFormat.of().formatHex(bytes);
    }

    public synchronized Connected connect(String token, Consumer<Object> send, Runnable close, String profileToken) {
        return connect(token, send, close, profileToken, null);
    }
    public synchronized Connected connect(String token, Consumer<Object> send, Runnable close, String profileToken, String accountProfileId) {
        User user = token == null ? null : sessions.get(token);
        if (user == null) {
            if (sessions.size() >= 1000) throw new IllegalStateException("Server đang đầy. Vui lòng thử lại sau.");
            user = new User();
            user.token = randomToken();
            sessions.put(user.token, user);
        }
        boolean switchingProfile = !Objects.equals(user.accountProfileId, accountProfileId);
        if (switchingProfile && user.roomId != null) leave(user);
        Runnable oldClose = user.close;
        user.connectionId = UUID.randomUUID().toString();
        user.send = send;
        user.close = close;
        user.online = true;
        user.lastSeen = now();
        if (switchingProfile || user.profile == null) {
            user.profile = accountProfileId == null ? history.profile(profileToken) : history.profileById(accountProfileId);
            user.name = user.profile.profile().name;
        }
        user.accountProfileId = accountProfileId;
        if (oldClose != null) oldClose.run();
        send.accept(map("type", "welcome", "id", user.id, "name", user.name, "token", user.token, "serverTime", now(),
                "profileToken", user.profile.token(), "profileId", user.profile.profile().id));
        Room room = rooms.get(user.roomId);
        if (room != null) {
            if ("player".equals(user.role) && "playing".equals(room.status) && room.players.stream().allMatch(p -> p.online)) {
                room.deadline = now() + (room.remaining == null ? TURN_MS : room.remaining);
                room.remaining = null;
            }
            broadcast(room);
        }
        lobby();
        stats(user);
        return new Connected(user, user.connectionId);
    }

    public synchronized int roomCount() { return rooms.size(); }

    private void send(User user, Object payload) { if (user.online && user.send != null) user.send.accept(payload); }
    private void error(User user, String message) { send(user, map("type", "error", "message", message)); }
    private void stats(User user) {
        send(user, map("type", "stats", "history", history.personal(user.profile.profile().id), "leaderboard", history.leaderboard()));
    }
    private void allStats() {
        List<Map<String, Object>> leaderboard = history.leaderboard();
        for (User user : sessions.values()) if (user.online)
            send(user, map("type", "stats", "history", history.personal(user.profile.profile().id), "leaderboard", leaderboard));
    }
    private void broadcast(Room room) {
        Map<String, Object> payload = map("type", "room", "room", RoomViewFactory.snapshot(room, now()));
        for (User player : room.players) send(player, payload);
        for (User spectator : room.spectators) send(spectator, payload);
    }
    private void lobby() {
        List<Map<String, Object>> list = rooms.values().stream().filter(r -> !r.players.isEmpty())
                .map(RoomViewFactory::lobbyRoom).toList();
        long online = sessions.values().stream().filter(p -> p.online).count();
        Map<String, Double> allScores = history.allScores();
        List<Map<String, Object>> onlineUsers = sessions.values().stream()
                .filter(u -> u.online)
                .map(u -> {
                    String status = "idle";
                    if (u.roomId != null) {
                        Room r = rooms.get(u.roomId);
                        if (r != null && "playing".equals(r.status)) status = "playing";
                        else if (r != null) status = "waiting";
                    } else if (queue.contains(u)) {
                        status = "matching";
                    }
                    String pid = u.profile != null ? u.profile.profile().id : null;
                    double score = (pid != null && allScores.containsKey(pid)) ? allScores.get(pid) : 0.0;
                    return map("id", u.id, "name", u.name, "status", status,
                            "profileId", pid, "score", score);
                }).toList();
        Map<String, Object> payload = map("type", "lobby", "rooms", list, "online", online,
                "matching", queue.size(), "users", onlineUsers);
        for (User user : sessions.values()) send(user, payload);
    }
    private void reset(Room room) {
        room.round = UUID.randomUUID().toString();
        room.finalPlayers = null;
        room.board = new ArrayList<>(Collections.nCopies(225, null));
        room.moves = new ArrayList<>();
        room.winner = null;
        room.line = List.of();
        room.reason = null;
        room.turn = "X";
        room.status = "playing";
        room.deadline = now() + TURN_MS;
        room.remaining = null;
        room.rematch.clear();
        room.drawOfferedBy = null;
    }
    private void finish(Room room, String winner, String reason, List<Integer> line) {
        room.finalPlayers = room.players.stream().map(p -> map("id", p.id, "name", p.name, "online", p.online)).toList();
        room.status = "finished";
        room.winner = winner;
        room.reason = reason;
        room.line = line;
        room.deadline = null;
        room.remaining = null;
        room.drawOfferedBy = null;
        if (room.players.size() == 2) {
            String winnerProfile = room.players.stream().filter(p -> p.id.equals(winner)).findFirst()
                    .map(p -> p.profile.profile().id).orElse(null);
            List<MatchRecord.Player> players = room.players.stream().map(p ->
                    new MatchRecord.Player(p.profile.profile().id, p.name)).toList();
            history.record(new MatchRecord(room.round, room.id, players, winnerProfile, reason, List.copyOf(room.moves), now()));
            allStats();
        }
    }
    private Room createRoom(User user) {
        if (rooms.size() >= 100) return null;
        String id;
        do {
            byte[] bytes = new byte[3]; random.nextBytes(bytes);
            id = java.util.HexFormat.of().withUpperCase().formatHex(bytes);
        } while (rooms.containsKey(id));
        Room room = new Room();
        room.id = id;
        room.players.add(user);
        rooms.put(id, room);
        user.roomId = id;
        user.role = "player";
        return room;
    }
    private void joinRoom(User user, Room room) {
        room.players.add(user);
        user.roomId = room.id;
        user.role = "player";
        reset(room);
        if (room.players.stream().anyMatch(p -> !p.online)) { room.remaining = TURN_MS; room.deadline = null; }
    }
    private void leave(User user) {
        if (queue.remove(user)) send(user, map("type", "matchmaking", "waiting", false));
        Room room = rooms.get(user.roomId);
        user.roomId = null;
        String role = user.role;
        user.role = null;
        send(user, map("type", "left"));
        if (room == null) { lobby(); return; }
        if ("spectator".equals(role)) {
            room.spectators.remove(user);
            if (room.players.isEmpty() && room.spectators.isEmpty()) rooms.remove(room.id);
            else broadcast(room);
            lobby(); return;
        }
        if ("playing".equals(room.status)) {
            String other = room.players.stream().filter(p -> !p.id.equals(user.id)).findFirst().map(p -> p.id).orElse(null);
            finish(room, other, "leave", List.of());
            broadcast(room);
        }
        room.players.remove(user);
        if (room.players.isEmpty()) {
            for (User spectator : room.spectators) {
                spectator.roomId = null; spectator.role = null;
                send(spectator, map("type", "left"));
            }
            room.spectators.clear();
            rooms.remove(room.id);
        } else {
            room.rematch.clear();
            broadcast(room);
            for (User remainingPlayer : room.players) {
                send(remainingPlayer, map("type", "notice", "message", user.name + " đã dừng chơi và rời khỏi phòng."));
            }
        }
        lobby();
    }
    private static String string(JsonNode data, String field) {
        JsonNode node = data.path(field);
        return node.isTextual() ? node.asText() : "";
    }
    private static String name(JsonNode data) {
        String value = string(data, "name").trim();
        return value.length() > 24 ? value.substring(0, 24) : value;
    }

    public synchronized void handle(User user, JsonNode data) {
        if (data == null || !data.isObject() || !data.path("type").isTextual()) {
            error(user, "Yêu cầu không hợp lệ."); return;
        }
        user.lastSeen = now();
        String type = string(data, "type");
        if (type.equals("stats")) { stats(user); return; }
        if (type.equals("rename")) {
            String newName = name(data);
            if (newName.isEmpty()) { error(user, "Tên không hợp lệ."); return; }
            user.name = newName;
            history.rename(user.profile, newName);
            if (user.roomId != null) {
                Room r = rooms.get(user.roomId);
                if (r != null) broadcast(r);
            }
            send(user, map("type", "renamed", "name", newName));
            lobby();
            allStats();
            return;
        }
        if (type.equals("invite")) {
            String targetId = string(data, "targetUserId");
            User target = sessions.values().stream().filter(u -> u.online && u.id.equals(targetId)).findFirst().orElse(null);
            if (target == null) { error(user, "Không tìm thấy người chơi này."); return; }
            if (target.id.equals(user.id)) { error(user, "Không thể tự mời bản thân."); return; }
            if (target.roomId != null || queue.contains(target)) { error(user, "Người chơi này đang bận."); return; }
            if (user.roomId != null || queue.contains(user)) { error(user, "Bạn đang trong phòng hoặc đang tìm trận."); return; }
            String invName = name(data);
            if (!invName.isEmpty()) { user.name = invName; history.rename(user.profile, invName); }

            Invitation inv = new Invitation();
            inv.from = user;
            inv.to = target;
            inv.expiresAt = now() + 60_000;
            invitations.put(inv.id, inv);

            send(target, map("type", "invitation", "id", inv.id, "fromId", user.id, "fromName", user.name, "name", user.name, "expiresAt", inv.expiresAt));
            send(user, map("type", "notice", "message", "Đã gửi lời mời đến " + target.name + "."));
            return;
        }
        if (type.equals("inviteResponse")) {
            String invId = string(data, "invitationId");
            boolean accept = data.path("accept").asBoolean(false);
            Invitation inv = invitations.remove(invId);
            if (inv == null || now() > inv.expiresAt) {
                error(user, "Lời mời đã hết hạn hoặc không tồn tại."); return;
            }
            if (!inv.to.id.equals(user.id)) {
                error(user, "Bạn không phải là người nhận lời mời này."); return;
            }
            if (!accept) {
                send(inv.from, map("type", "notice", "message", user.name + " đã từ chối lời mời thách đấu."));
                return;
            }
            if (!inv.from.online) { error(user, "Người mời đã ngoại tuyến."); return; }
            if (inv.from.roomId != null || user.roomId != null) { error(user, "Một trong hai người đang bận."); return; }

            // Người thách đấu nhận O (đi sau), người bị thách đấu nhận X (đi trước)
            Room room = createRoom(user);
            if (room == null) { error(user, "Đã đạt giới hạn 100 phòng."); return; }
            joinRoom(inv.from, room);
            broadcast(room);
            lobby();
            return;
        }
        if (type.equals("cancelMatch")) {
            queue.remove(user); send(user, map("type", "matchmaking", "waiting", false)); lobby(); return;
        }
        if (type.equals("match")) {
            if (user.roomId != null) { error(user, "Hãy rời phòng hiện tại trước."); return; }
            String name = name(data);
            if (name.isEmpty()) name = user.name;
            if (name.isEmpty()) { error(user, "Bạn hãy nhập tên trước khi tìm trận."); return; }
            user.name = name; history.rename(user.profile, name);
            if (queue.contains(user)) return;
            User opponent = queue.findOpponent(user);
            if (opponent != null) {
                Room room = createRoom(opponent);
                if (room == null) { error(user, "Đã đạt giới hạn 100 phòng."); return; }
                queue.remove(opponent);
                send(opponent, map("type", "matchmaking", "waiting", false));
                send(user, map("type", "matchmaking", "waiting", false));
                joinRoom(user, room); broadcast(room); lobby();
            } else {
                queue.add(user); send(user, map("type", "matchmaking", "waiting", true)); lobby();
            }
            return;
        }
        if (type.equals("spectate")) {
            if (user.roomId != null || queue.contains(user)) { error(user, "Hãy rời phòng hoặc hủy tìm trận trước."); return; }
            Room room = rooms.get(string(data, "roomId").trim().toUpperCase());
            if (room == null || room.players.isEmpty()) { error(user, "Không tìm thấy phòng để xem."); return; }
            user.roomId = room.id; user.role = "spectator"; room.spectators.add(user);
            broadcast(room); lobby(); return;
        }
        if (type.equals("create") || type.equals("join")) {
            if (user.roomId != null || queue.contains(user)) { error(user, "Hãy rời phòng hoặc hủy tìm trận trước."); return; }
            String name = name(data);
            if (name.isEmpty()) name = user.name;
            if (name.isEmpty()) { error(user, "Bạn hãy nhập tên trước khi vào phòng."); return; }
            user.name = name; history.rename(user.profile, name);
            Room room;
            if (type.equals("create")) {
                room = createRoom(user);
                if (room == null) { error(user, "Đã đạt giới hạn 100 phòng."); return; }
            } else {
                room = rooms.get(string(data, "roomId").trim().toUpperCase());
                if (room == null) { error(user, "Không tìm thấy phòng. Hãy kiểm tra lại mã."); return; }
                if (room.players.size() >= 2 || !room.status.equals("waiting")) {
                    error(user, "Phòng đã đủ người hoặc đã bắt đầu."); return;
                }
                if (room.players.getFirst().profile.profile().id.equals(user.profile.profile().id)) {
                    error(user, "Không thể chơi với cùng một tài khoản."); return;
                }
                joinRoom(user, room);
            }
            broadcast(room); lobby(); return;
        }
        if (type.equals("leave")) { leave(user); return; }
        Room room = rooms.get(user.roomId);
        if (room == null) { error(user, "Bạn chưa ở trong phòng chơi."); return; }
        if (!"player".equals(user.role)) { error(user, "Khán giả chỉ có thể theo dõi ván đấu."); return; }
        if (type.equals("move")) {
            if (!"playing".equals(room.status)) { error(user, "Ván đấu chưa bắt đầu hoặc đã kết thúc."); return; }
            if (room.players.stream().anyMatch(p -> !p.online)) { error(user, "Đang đợi đối thủ kết nối lại."); return; }
            if (room.deadline != null && now() >= room.deadline) { tick(); return; }
            String symbol = room.players.getFirst().id.equals(user.id) ? "X" : "O";
            if (!room.turn.equals(symbol)) { error(user, "Chưa đến lượt của bạn."); return; }
            JsonNode indexNode = data.path("index");
            int index = indexNode.isIntegralNumber() ? indexNode.asInt(-1) : -1;
            if (index < 0 || index >= 225 || room.board.get(index) != null) { error(user, "Ô cờ không hợp lệ."); return; }
            room.drawOfferedBy = null;
            room.board.set(index, symbol);
            room.moves.add(new MatchRecord.Move(index, symbol));
            List<Integer> line = GameRules.winningLine(room.board, index, symbol);
            if (!line.isEmpty()) finish(room, user.id, "five", line);
            else if (room.moves.size() == 225) finish(room, null, "draw", List.of());
            else { room.turn = symbol.equals("X") ? "O" : "X"; room.deadline = now() + TURN_MS; }
            broadcast(room);
        } else if (type.equals("chat")) {
            String content = string(data, "text").trim();
            if (content.length() > 300) content = content.substring(0, 300);
            if (content.isEmpty()) return;
            if (user.lastChat >= 0 && now() - user.lastChat < 500) { error(user, "Bạn đang gửi tin nhắn quá nhanh."); return; }
            user.lastChat = now();
            room.messages.add(map("id", UUID.randomUUID().toString(), "userId", user.id, "name", user.name,
                    "text", content, "at", now()));
            if (room.messages.size() > 60) room.messages.removeFirst();
            broadcast(room);
        } else if (type.equals("drawOffer")) {
            if (!"playing".equals(room.status)) return;
            if (room.players.size() < 2) return;
            if (room.drawOfferedBy != null && room.drawOfferedBy.equals(user.id)) {
                error(user, "Bạn đã gửi đề nghị hòa rồi."); return;
            }
            room.drawOfferedBy = user.id;
            broadcast(room);
            String other = room.players.stream().filter(p -> !p.id.equals(user.id)).findFirst().map(p -> p.id).orElse(null);
            if (other != null) {
                room.players.stream().filter(p -> p.id.equals(other)).findFirst()
                        .ifPresent(p -> send(p, map("type", "notice", "message", user.name + " đã gửi lời mời cầu hòa.")));
            }
        } else if (type.equals("drawResponse")) {
            if (!"playing".equals(room.status)) return;
            boolean accept = data.path("accept").asBoolean(false);
            if (room.drawOfferedBy == null || room.drawOfferedBy.equals(user.id)) return;
            if (accept) {
                room.drawOfferedBy = null;
                finish(room, null, "agreement", List.of());
            } else {
                String requester = room.drawOfferedBy;
                room.drawOfferedBy = null;
                broadcast(room);
                room.players.stream().filter(p -> p.id.equals(requester)).findFirst()
                        .ifPresent(p -> send(p, map("type", "notice", "message", user.name + " đã từ chối đề nghị hòa.")));
                return;
            }
            broadcast(room);
        } else if (type.equals("resign")) {
            if (!"playing".equals(room.status)) return;
            String other = room.players.stream().filter(p -> !p.id.equals(user.id)).findFirst().map(p -> p.id).orElse(null);
            finish(room, other, "resign", List.of()); broadcast(room);
        } else if (type.equals("rematchDecline")) {
            if (!"finished".equals(room.status)) return;
            if (room.rematch.size() != 1 || room.rematch.contains(user.id)) {
                error(user, "Không có lời mời chơi lại nào cần phản hồi."); return;
            }
            String requesterId = room.rematch.iterator().next();
            room.rematch.clear();
            broadcast(room);
            room.players.stream().filter(player -> player.id.equals(requesterId)).findFirst()
                    .ifPresent(player -> send(player, map("type", "notice", "message", user.name + " đã từ chối lời mời chơi lại.")));
        } else if (type.equals("rematch")) {
            if (!"finished".equals(room.status)) return;
            if (room.players.size() < 2) { error(user, "Đối thủ đã rời phòng. Hãy tạo phòng mới."); return; }
            room.rematch.add(user.id);
            if (room.rematch.size() == 2 && room.players.stream().allMatch(p -> p.online)) {
                Collections.reverse(room.players); reset(room);
            }
            broadcast(room);
        }
    }

    public synchronized void disconnect(User user, String connectionId) {
        if (!connectionId.equals(user.connectionId)) return;
        user.online = false; user.lastSeen = now();
        queue.remove(user);
        invitations.values().removeIf(inv -> inv.from.id.equals(user.id) || inv.to.id.equals(user.id));
        Room room = rooms.get(user.roomId);
        if (room != null) {
            if ("player".equals(user.role) && "playing".equals(room.status) && room.remaining == null) {
                room.remaining = Math.max(0, room.deadline - now()); room.deadline = null;
            }
            broadcast(room);
        }
        lobby();
    }

    @Scheduled(fixedDelay = 250)
    public synchronized void tick() {
        invitations.values().removeIf(inv -> now() > inv.expiresAt);
        for (User user : new ArrayList<>(sessions.values())) {
            if (!user.online && now() - user.lastSeen >= RECONNECT_MS && user.roomId != null) leave(user);
            if (!user.online && user.roomId == null && now() - user.lastSeen > 600_000) sessions.remove(user.token);
        }
        for (Room room : new ArrayList<>(rooms.values())) {
            if ("playing".equals(room.status) && room.remaining == null && room.deadline != null && now() >= room.deadline) {
                if (room.moves.isEmpty()) {
                    finish(room, null, "timeout", List.of());
                } else {
                    int loser = room.turn.equals("X") ? 0 : 1;
                    finish(room, room.players.get(1 - loser).id, "timeout", List.of());
                }
                broadcast(room);
            }
        }
    }
}
