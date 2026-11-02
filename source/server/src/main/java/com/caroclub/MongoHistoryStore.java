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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

@Service
public class MongoHistoryStore implements HistoryStore {
    private final MongoTemplate mongo;
    private final ObjectMapper json;
    private final SecureRandom random = new SecureRandom();

    public MongoHistoryStore(MongoTemplate mongo, ObjectMapper json, @Value("${caro.legacy-history-file:}") String legacyFile) throws IOException {
        this.mongo = mongo;
        this.json = json;
        mongo.executeCommand("{ping:1}");
        if (!legacyFile.isBlank()) importLegacy(Path.of(legacyFile));
    }

    private static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    @Override public ProfileSession profile(String token) {
        if (token != null && !token.isBlank()) {
            Profile found = mongo.findOne(Query.query(Criteria.where("tokenHash").is(hash(token))), Profile.class);
            if (found != null) return new ProfileSession(found, token);
        }
        byte[] bytes = new byte[24];
        random.nextBytes(bytes);
        String newToken = HexFormat.of().formatHex(bytes);
        Profile created = mongo.insert(new Profile(UUID.randomUUID().toString(), hash(newToken), "Người chơi"));
        return new ProfileSession(created, newToken);
    }

    @Override public ProfileSession profileById(String id) {
        Profile profile = mongo.findById(id, Profile.class);
        if (profile == null) throw new IllegalStateException("Không tìm thấy hồ sơ tài khoản.");
        return new ProfileSession(profile, null);
    }

    @Override public void rename(ProfileSession profile, String name) {
        if (!profile.profile().name.equals(name)) {
            profile.profile().name = name;
            mongo.save(profile.profile());
        }
    }

    @Override public void record(MatchRecord match) {
        if (mongo.exists(Query.query(Criteria.where("_id").is(match.id)), MatchRecord.class)) return;
        mongo.insert(match);
        // Keep the same bounded history as the previous demo.
        Query old = new Query().with(Sort.by(Sort.Direction.DESC, "at")).skip(5000);
        old.fields().include("_id");
        for (MatchRecord record : mongo.find(old, MatchRecord.class)) mongo.remove(record);
    }

    @Override public List<MatchRecord> personal(String profileId) {
        Query query = Query.query(Criteria.where("players.id").is(profileId))
                .with(Sort.by(Sort.Direction.DESC, "at")).limit(30);
        return mongo.find(query, MatchRecord.class);
    }

    @Override public List<Map<String, Object>> leaderboard() {
        List<MatchRecord> matches = mongo.find(new Query().with(Sort.by(Sort.Direction.DESC, "at")).limit(5000), MatchRecord.class);
        Map<String, Score> scores = new HashMap<>();
        for (MatchRecord match : matches) {
            for (MatchRecord.Player player : match.players) {
                Score score = scores.computeIfAbsent(player.id(), id -> new Score(id, player.name()));
                score.played++;
                if (player.id().equals(match.winner)) score.wins++;
                if (match.winner == null) score.draws++;
            }
        }
        if (!scores.isEmpty()) for (Profile profile : mongo.find(Query.query(Criteria.where("_id").in(scores.keySet())), Profile.class)) {
            scores.get(profile.id).name = profile.name;
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
