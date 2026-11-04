package com.caroclub;

import java.util.List;
import java.util.Map;

public interface HistoryStore {
    ProfileSession profile(String token);
    ProfileSession profileById(String id);
    void rename(ProfileSession profile, String name);
    void record(MatchRecord match);
    List<MatchRecord> personal(String profileId);
    List<Map<String, Object>> leaderboard();
    default Map<String, Double> allScores() { return Map.of(); }
    record ProfileSession(Profile profile, String token) {}
}
