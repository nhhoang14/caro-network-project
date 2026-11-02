import { randomBytes, randomUUID } from "node:crypto";
import { emptyBoard, winningLine } from "../shared/game.mjs";

export const TURN_MS = 30_000;
export const RECONNECT_MS = 30_000;

export class RoomService {
  constructor(now = () => Date.now(), history = null) {
    this.now = now;
    this.history = history;
    this.sessions = new Map();
    this.rooms = new Map();
    this.queue = new Set();
  }

  connect(token, send, close, profileToken = null) {
    let user = typeof token === "string" ? this.sessions.get(token) : null;
    if (!user) {
      if (this.sessions.size >= 1000)
        throw new Error("Server đang đầy. Vui lòng thử lại sau.");
      user = {
        id: randomUUID(),
        token: randomBytes(24).toString("hex"),
        name: "Người chơi",
        roomId: null,
        role: null,
      };
      this.sessions.set(user.token, user);
    }
    const oldClose = user.close;
    user.connectionId = randomUUID();
    user.send = send;
    user.close = close;
    user.online = true;
    user.lastSeen = this.now();
    if (this.history && !user.profile) user.profile = this.history.profile(profileToken);
    oldClose?.();
    send({
      type: "welcome",
      id: user.id,
      token: user.token,
      serverTime: this.now(),
      profileToken: user.profile?.token,
      profileId: user.profile?.id,
    });
    const room = this.rooms.get(user.roomId);
    if (room) {
      if (user.role === "player" && room.status === "playing" && room.players.every((p) => p.online)) {
        room.deadline = this.now() + (room.remaining ?? TURN_MS);
        room.remaining = null;
      }
      this.broadcast(room);
    }
    this.lobby();
    this.stats(user);
    return { user, connectionId: user.connectionId };
  }

  stats(user) {
    if (!this.history) return;
    this.send(user, { type: "stats", history: this.history.personal(user.profile.id), leaderboard: this.history.leaderboard() });
  }

  allStats() {
    this.sessions.forEach((user) => this.stats(user));
  }

  send(user, payload) {
    if (user.online) user.send?.(payload);
  }
  error(user, message) {
    this.send(user, { type: "error", message });
  }

  snapshot(room) {
    return {
      id: room.id,
      round: room.round,
      board: room.board,
      status: room.status,
      turn: room.turn,
      players:
        room.finalPlayers ||
        room.players.map((p) => ({ id: p.id, name: p.name, online: p.online })),
      moves: room.moves,
      winner: room.winner,
      line: room.line,
      reason: room.reason,
      deadline: room.remaining != null ? null : room.deadline,
      remaining: room.remaining,
      messages: room.messages,
      rematch: [...room.rematch],
      spectators: room.spectators.size,
      serverTime: this.now(),
    };
  }

  broadcast(room) {
    const payload = { type: "room", room: this.snapshot(room) };
    [...room.players, ...room.spectators].forEach((p) => this.send(p, payload));
  }

  lobby() {
    const rooms = [...this.rooms.values()]
      .filter((r) => r.players.length > 0)
      .map((r) => ({
        id: r.id,
        host: r.players[0].name,
        count: r.players.length,
        status: r.status,
        spectators: r.spectators.size,
      }));
    const payload = {
      type: "lobby",
      rooms,
      online: [...this.sessions.values()].filter((p) => p.online).length,
      matching: this.queue.size,
    };
    this.sessions.forEach((p) => this.send(p, payload));
  }

  reset(room) {
    Object.assign(room, {
      round: randomUUID(),
      finalPlayers: null,
      board: emptyBoard(),
      moves: [],
      winner: null,
      line: [],
      reason: null,
      turn: "X",
      status: "playing",
      deadline: this.now() + TURN_MS,
      remaining: null,
      rematch: new Set(),
    });
  }

  finish(room, winner, reason, line = []) {
    room.finalPlayers = room.players.map((p) => ({
      id: p.id,
      name: p.name,
      online: p.online,
    }));
    Object.assign(room, {
      status: "finished",
      winner,
      reason,
      line,
      deadline: null,
      remaining: null,
    });
    if (this.history && room.players.length === 2) {
      this.history.record(room, this.now());
      this.allStats();
    }
  }

  createRoom(user) {
    if (this.rooms.size >= 100) return null;
    let id;
    do { id = randomBytes(3).toString("hex").toUpperCase(); } while (this.rooms.has(id));
    const room = {
      id, round: randomUUID(), players: [user], spectators: new Set(),
      board: emptyBoard(), moves: [], turn: "X", status: "waiting",
      winner: null, line: [], reason: null, deadline: null, remaining: null,
      messages: [], rematch: new Set(),
    };
    this.rooms.set(id, room);
    user.roomId = id;
    user.role = "player";
    return room;
  }

  joinRoom(user, room) {
    room.players.push(user);
    user.roomId = room.id;
    user.role = "player";
    this.reset(room);
    if (!room.players.every((p) => p.online)) {
      room.remaining = TURN_MS;
      room.deadline = null;
    }
  }

  leave(user) {
    if (this.queue.delete(user)) this.send(user, { type: "matchmaking", waiting: false });
    const room = this.rooms.get(user.roomId);
    user.roomId = null;
    const role = user.role;
    user.role = null;
    this.send(user, { type: "left" });
    if (!room) { this.lobby(); return; }
    if (role === "spectator") {
      room.spectators.delete(user);
      if (!room.players.length && !room.spectators.size) this.rooms.delete(room.id);
      else this.broadcast(room);
      this.lobby();
      return;
    }
    if (room.status === "playing") {
      const other = room.players.find((p) => p.id !== user.id);
      this.finish(room, other?.id ?? null, "leave");
      // Send the final result before removing a seat, preserving X/O assignments.
      this.broadcast(room);
    }
    room.players = room.players.filter((p) => p.id !== user.id);
    if (!room.players.length) {
      for (const spectator of room.spectators) {
        spectator.roomId = null;
        spectator.role = null;
        this.send(spectator, { type: "left" });
      }
      room.spectators.clear();
      this.rooms.delete(room.id);
    } else {
      room.rematch.clear();
      this.broadcast(room);
    }
    this.lobby();
  }

  handle(user, data) {
    if (!data || typeof data !== "object" || typeof data.type !== "string")
      return this.error(user, "Yêu cầu không hợp lệ.");
    user.lastSeen = this.now();
    if (data.type === "stats") return this.stats(user);
    if (data.type === "cancelMatch") {
      this.queue.delete(user);
      this.send(user, { type: "matchmaking", waiting: false });
      this.lobby();
      return;
    }
    if (data.type === "match") {
      if (user.roomId) return this.error(user, "Hãy rời phòng hiện tại trước.");
      const name = typeof data.name === "string" ? data.name.trim().slice(0, 24) : "";
      if (!name) return this.error(user, "Bạn hãy nhập tên trước khi tìm trận.");
      user.name = name;
      if (user.profile) this.history.rename(user.profile, name);
      if (this.queue.has(user)) return;
      const opponent = [...this.queue].find((p) => p.online && p.id !== user.id && !p.roomId);
      if (opponent) {
        this.queue.delete(opponent);
        const room = this.createRoom(opponent);
        if (!room) return this.error(user, "Đã đạt giới hạn 100 phòng.");
        this.send(opponent, { type: "matchmaking", waiting: false });
        this.send(user, { type: "matchmaking", waiting: false });
        this.joinRoom(user, room);
        this.broadcast(room);
        this.lobby();
      } else {
        this.queue.add(user);
        this.send(user, { type: "matchmaking", waiting: true });
        this.lobby();
      }
      return;
    }
    if (data.type === "spectate") {
      if (user.roomId || this.queue.has(user)) return this.error(user, "Hãy rời phòng hoặc hủy tìm trận trước.");
      const id = typeof data.roomId === "string" ? data.roomId.trim().toUpperCase() : "";
      const room = this.rooms.get(id);
      if (!room || !room.players.length) return this.error(user, "Không tìm thấy phòng để xem.");
      user.roomId = id;
      user.role = "spectator";
      room.spectators.add(user);
      this.broadcast(room);
      this.lobby();
      return;
    }
    if (data.type === "create" || data.type === "join") {
      if (user.roomId || this.queue.has(user)) return this.error(user, "Hãy rời phòng hoặc hủy tìm trận trước.");
      const name =
        typeof data.name === "string" ? data.name.trim().slice(0, 24) : "";
      if (!name)
        return this.error(user, "Bạn hãy nhập tên trước khi vào phòng.");
      user.name = name;
      if (user.profile) this.history.rename(user.profile, name);
      let room;
      if (data.type === "create") {
        room = this.createRoom(user);
        if (!room) return this.error(user, "Đã đạt giới hạn 100 phòng.");
      } else {
        const id =
          typeof data.roomId === "string"
            ? data.roomId.trim().toUpperCase()
            : "";
        room = this.rooms.get(id);
        if (!room)
          return this.error(user, "Không tìm thấy phòng. Hãy kiểm tra lại mã.");
        if (room.players.length >= 2 || room.status !== "waiting")
          return this.error(user, "Phòng đã đủ người hoặc đã bắt đầu.");
        this.joinRoom(user, room);
      }
      user.roomId = room.id;
      this.broadcast(room);
      this.lobby();
      return;
    }
    if (data.type === "leave") return this.leave(user);
    const room = this.rooms.get(user.roomId);
    if (!room) return this.error(user, "Bạn chưa ở trong phòng chơi.");
    if (user.role !== "player") return this.error(user, "Khán giả chỉ có thể theo dõi ván đấu.");
    if (data.type === "move") {
      if (room.status !== "playing")
        return this.error(user, "Ván đấu chưa bắt đầu hoặc đã kết thúc.");
      if (room.players.some((p) => !p.online))
        return this.error(user, "Đang đợi đối thủ kết nối lại.");
      // Enforce the deadline here too, before the periodic timer has a chance to run.
      if (this.now() >= room.deadline) {
        this.tick();
        return;
      }
      const symbol = room.players[0].id === user.id ? "X" : "O";
      if (room.turn !== symbol)
        return this.error(user, "Chưa đến lượt của bạn.");
      const i = data.index;
      if (
        !Number.isInteger(i) ||
        i < 0 ||
        i >= room.board.length ||
        room.board[i]
      )
        return this.error(user, "Ô cờ không hợp lệ.");
      room.board[i] = symbol;
      room.moves.push({ index: i, symbol });
      const line = winningLine(room.board, i, symbol);
      if (line.length) this.finish(room, user.id, "five", line);
      else if (room.moves.length === room.board.length)
        this.finish(room, null, "draw");
      else {
        room.turn = symbol === "X" ? "O" : "X";
        room.deadline = this.now() + TURN_MS;
      }
      this.broadcast(room);
    } else if (data.type === "chat") {
      const content =
        typeof data.text === "string" ? data.text.trim().slice(0, 300) : "";
      if (!content) return;
      if (user.lastChat != null && this.now() - user.lastChat < 500)
        return this.error(user, "Bạn đang gửi tin nhắn quá nhanh.");
      user.lastChat = this.now();
      room.messages.push({
        id: randomUUID(),
        userId: user.id,
        name: user.name,
        text: content,
        at: this.now(),
      });
      room.messages = room.messages.slice(-60);
      this.broadcast(room);
    } else if (data.type === "resign") {
      if (room.status !== "playing") return;
      this.finish(
        room,
        room.players.find((p) => p.id !== user.id)?.id ?? null,
        "resign",
      );
      this.broadcast(room);
    } else if (data.type === "rematch") {
      if (room.status !== "finished") return;
      if (room.players.length < 2)
        return this.error(user, "Đối thủ đã rời phòng. Hãy tạo phòng mới.");
      room.rematch.add(user.id);
      if (room.rematch.size === 2 && room.players.every((p) => p.online)) {
        room.players.reverse();
        this.reset(room);
      }
      this.broadcast(room);
    }
  }

  disconnect(user, connectionId) {
    if (user.connectionId !== connectionId) return;
    user.online = false;
    user.lastSeen = this.now();
    if (this.queue.delete(user)) this.send(user, { type: "matchmaking", waiting: false });
    const room = this.rooms.get(user.roomId);
    if (room) {
      if (user.role === "player" && room.status === "playing" && room.remaining == null) {
        room.remaining = Math.max(0, room.deadline - this.now());
        room.deadline = null;
      }
      this.broadcast(room);
    }
    this.lobby();
  }

  tick() {
    for (const user of this.sessions.values()) {
      if (
        !user.online &&
        this.now() - user.lastSeen >= RECONNECT_MS &&
        user.roomId
      )
        this.leave(user);
      if (
        !user.online &&
        !user.roomId &&
        this.now() - user.lastSeen > 10 * 60_000
      )
        this.sessions.delete(user.token);
    }
    for (const room of this.rooms.values()) {
      if (
        room.status === "playing" &&
        room.remaining == null &&
        this.now() >= room.deadline
      ) {
        const loser = room.turn === "X" ? 0 : 1;
        this.finish(room, room.players[1 - loser].id, "timeout");
        this.broadcast(room);
      }
    }
  }
}
