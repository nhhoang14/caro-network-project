package com.caroclub.model;

import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("matches")
public class MatchRecord {
    @Id public String id;
    public String roomId;
    public List<Player> players;
    public String winner;
    public String reason;
    public List<Move> moves;
    @Indexed public long at;

    public MatchRecord() {}
    public MatchRecord(String id, String roomId, List<Player> players, String winner, String reason, List<Move> moves, long at) {
        this.id = id;
        this.roomId = roomId;
        this.players = players;
        this.winner = winner;
        this.reason = reason;
        this.moves = moves;
        this.at = at;
    }
    public record Player(String id, String name) {}
    public record Move(int index, String symbol) {}
}

