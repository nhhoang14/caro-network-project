import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Small durable store for the demo. Writes are atomic and records are bounded. */
export class HistoryStore {
  constructor(file) {
    this.file = file;
    this.profiles = new Map();
    this.matches = [];
    if (existsSync(file)) {
      const data = JSON.parse(readFileSync(file, "utf8"));
      for (const profile of data.profiles || []) this.profiles.set(profile.token, profile);
      this.matches = Array.isArray(data.matches) ? data.matches : [];
    }
  }

  save() {
    mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify({ profiles: [...this.profiles.values()], matches: this.matches }), "utf8");
    renameSync(temp, this.file);
  }

  profile(token) {
    let value = typeof token === "string" ? this.profiles.get(token) : null;
    if (!value) {
      value = { id: randomUUID(), token: randomBytes(24).toString("hex"), name: "Người chơi" };
      this.profiles.set(value.token, value);
      this.save();
    }
    return value;
  }

  rename(profile, name) {
    if (profile.name === name) return;
    profile.name = name;
    this.save();
  }

  record(room, at) {
    if (this.matches.some((match) => match.id === room.round)) return;
    this.matches.unshift({
      id: room.round,
      roomId: room.id,
      players: room.players.map((p) => ({ id: p.profile?.id || p.id, name: p.name })),
      winner: room.players.find((p) => p.id === room.winner)?.profile?.id || null,
      reason: room.reason,
      moves: room.moves.map((move) => ({ ...move })),
      at,
    });
    this.matches = this.matches.slice(0, 5000);
    this.save();
  }

  personal(profileId) {
    return this.matches.filter((match) => match.players.some((p) => p.id === profileId)).slice(0, 30);
  }

  leaderboard() {
    const scores = new Map();
    for (const match of this.matches) {
      for (const player of match.players) {
        const current = scores.get(player.id) || { id: player.id, name: player.name, wins: 0, draws: 0, played: 0 };
        current.played++;
        if (match.winner === player.id) current.wins++;
        if (!match.winner) current.draws++;
        scores.set(player.id, current);
      }
    }
    for (const profile of this.profiles.values()) {
      const score = scores.get(profile.id);
      if (score) score.name = profile.name;
    }
    return [...scores.values()].sort((a, b) => b.wins - a.wins || b.draws - a.draws || a.played - b.played).slice(0, 20);
  }
}
