package com.caroclub;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

@Service
public class MongoHistoryStore implements HistoryStore {
    private static final Logger log = LoggerFactory.getLogger(MongoHistoryStore.class);
    private final MongoTemplate mongo;
    private final ObjectMapper json;
    private final SecureRandom random = new SecureRandom();
    private final boolean mongoAvailable;
    private final Map<String, Profile> memoryProfiles = new ConcurrentHashMap<>();
    private final List<MatchRecord> memoryMatches = new CopyOnWriteArrayList<>();

    public MongoHistoryStore(MongoTemplate mongo, ObjectMapper json, @Value("${caro.legacy-history-file:}") String legacyFile) {
        this.mongo = mongo;
        this.json = json;
        boolean available = false;
        try {
            mongo.executeCommand("{ping:1}");
            available = true;
            log.info("Kết nối MongoDB thành công.");
        } catch (Exception e) {
            log.warn("MongoDB không khả dụng. Tự động chuyển sang chế độ In-Memory Fallback: {}", e.getMessage());
        }
        this.mongoAvailable = available;
        if (available && !legacyFile.isBlank()) {
            try { importLegacy(Path.of(legacyFile)); }
            catch (Exception e) { log.warn("Không thể nhập legacy history: {}", e.getMessage()); }
        }
    }

    public boolean isMongoAvailable() {
        return mongoAvailable;
    }

    private static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    @Override public ProfileSession profile(String token) {
        if (mongoAvailable) {
            try {
                if (token != null && !token.isBlank()) {
                    Profile found = mongo.findOne(Query.query(Criteria.where("tokenHash").is(hash(token))), Profile.class);
                    if (found != null) {
                        memoryProfiles.put(found.id, found);
                        return new ProfileSession(found, token);
                    }
                }
                byte[] bytes = new byte[24];
                random.nextBytes(bytes);
                String newToken = HexFormat.of().formatHex(bytes);
                Profile created = mongo.insert(new Profile(UUID.randomUUID().toString(), hash(newToken), "Người chơi"));
                memoryProfiles.put(created.id, created);
                return new ProfileSession(created, newToken);
            } catch (Exception e) {
                log.warn("Thao tác MongoDB thất bại, chuyển sang bộ nhớ đệm: {}", e.getMessage());
            }
        }
        // In-memory fallback
        if (token != null && !token.isBlank()) {
            String tokenHash = hash(token);
            for (Profile p : memoryProfiles.values()) {
                if (tokenHash.equals(p.tokenHash)) return new ProfileSession(p, token);
            }
        }
        byte[] bytes = new byte[24];
        random.nextBytes(bytes);
        String newToken = HexFormat.of().formatHex(bytes);
        Profile created = new Profile(UUID.randomUUID().toString(), hash(newToken), "Người chơi");
        memoryProfiles.put(created.id, created);
        return new ProfileSession(created, newToken);
    }

    @Override public ProfileSession profileById(String id) {
        if (mongoAvailable) {
            try {
                Profile profile = mongo.findById(id, Profile.class);
                if (profile != null) {
                    memoryProfiles.put(profile.id, profile);
                    return new ProfileSession(profile, null);
                }
            } catch (Exception e) {
                log.warn("Lỗi đọc MongoDB profile, chuyển sang bộ nhớ đệm: {}", e.getMessage());
            }
        }
        Profile mem = memoryProfiles.get(id);
        if (mem != null) return new ProfileSession(mem, null);
        throw new IllegalStateException("Không tìm thấy hồ sơ tài khoản.");
    }

    @Override public void rename(ProfileSession profile, String name) {
        if (!profile.profile().name.equals(name)) {
            profile.profile().name = name;
            memoryProfiles.put(profile.profile().id, profile.profile());
            if (mongoAvailable) {
                try { mongo.save(profile.profile()); }
                catch (Exception e) { log.warn("Lỗi lưu profile MongoDB: {}", e.getMessage()); }
            }
        }
    }

    @Override public void record(MatchRecord match) {
        memoryMatches.add(match);
        if (mongoAvailable) {
            try {
                if (!mongo.exists(Query.query(Criteria.where("_id").is(match.id)), MatchRecord.class)) {
                    mongo.insert(match);
                    Query old = new Query().with(Sort.by(Sort.Direction.DESC, "at")).skip(5000);
                    old.fields().include("_id");
                    for (MatchRecord record : mongo.find(old, MatchRecord.class)) mongo.remove(record);
                }
            } catch (Exception e) {
                log.warn("Lỗi ghi ván cờ vào MongoDB: {}", e.getMessage());
            }
        }
    }

    @Override public List<MatchRecord> personal(String profileId) {
        if (mongoAvailable) {
            try {
                Query query = Query.query(Criteria.where("players.id").is(profileId))
                        .with(Sort.by(Sort.Direction.DESC, "at")).limit(30);
                return mongo.find(query, MatchRecord.class);
            } catch (Exception e) {
                log.warn("Lỗi đọc lịch sử cá nhân MongoDB: {}", e.getMessage());
            }
        }
        return memoryMatches.stream()
                .filter(m -> m.players != null && m.players.stream().anyMatch(p -> p.id().equals(profileId)))
                .sorted(Comparator.comparingLong((MatchRecord m) -> m.at).reversed())
                .limit(30)
                .toList();
    }

    @Override public List<Map<String, Object>> leaderboard() {
        List<MatchRecord> matches;
        if (mongoAvailable) {
            try {
                matches = mongo.find(new Query().with(Sort.by(Sort.Direction.DESC, "at")).limit(5000), MatchRecord.class);
            } catch (Exception e) {
                matches = memoryMatches;
            }
        } else {
            matches = memoryMatches;
        }
        Map<String, Score> scores = new HashMap<>();
        for (MatchRecord match : matches) {
            if (match.players == null) continue;
            for (MatchRecord.Player player : match.players) {
                Score score = scores.computeIfAbsent(player.id(), id -> new Score(id, player.name()));
                score.played++;
                if (player.id().equals(match.winner)) score.wins++;
                if (match.winner == null) score.draws++;
            }
        }
        if (!scores.isEmpty()) {
            if (mongoAvailable) {
                try {
                    for (Profile profile : mongo.find(Query.query(Criteria.where("_id").in(scores.keySet())), Profile.class)) {
                        Score sc = scores.get(profile.id);
                        if (sc != null) sc.name = profile.name;
                    }
                } catch (Exception ignored) {}
            }
            for (Profile p : memoryProfiles.values()) {
                Score sc = scores.get(p.id);
                if (sc != null) sc.name = p.name;
            }
        }
        return scores.values().stream()
                .sorted(Comparator.comparingInt((Score s) -> s.wins).reversed()
                        .thenComparing(Comparator.comparingInt((Score s) -> s.draws).reversed())
                        .thenComparingInt(s -> s.played))
                .limit(20).map(Score::asMap).toList();
    }

    private void importLegacy(Path file) throws IOException {
        if (!Files.isRegularFile(file)) throw new IOException("Legacy history file not found: " + file);
        JsonNode root = json.readTree(Files.readString(file));
        for (JsonNode item : root.path("profiles")) {
            String id = item.path("id").asText();
            String token = item.path("token").asText();
            if (!id.isBlank() && !token.isBlank() && !mongo.exists(Query.query(Criteria.where("_id").is(id)), Profile.class)) {
                mongo.insert(new Profile(id, hash(token), item.path("name").asText("Người chơi")));
            }
        }
        for (JsonNode item : root.path("matches")) {
            MatchRecord record = json.treeToValue(item, MatchRecord.class);
            if (record.id != null && !mongo.exists(Query.query(Criteria.where("_id").is(record.id)), MatchRecord.class)) mongo.insert(record);
        }
    }

    private static final class Score {
        final String id;
        String name;
        int wins, draws, played;
        Score(String id, String name) { this.id = id; this.name = name; }
        Map<String, Object> asMap() { return Map.of("id", id, "name", name, "wins", wins, "draws", draws, "played", played); }
    }
}
