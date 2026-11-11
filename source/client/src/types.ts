import type { Stone } from "../../shared/game.mjs";

export type Player = { id: string; name: string; online: boolean };
export type Move = { index: number; symbol: "X" | "O" };
export type Message = {
  id: string;
  userId: string;
  name: string;
  text: string;
  at: number;
};

export type Room = {
  id: string;
  round: string;
  board: Stone[];
  status: "waiting" | "playing" | "finished";
  turn: "X" | "O";
  players: Player[];
  moves: Move[];
  winner: string | null;
  line: number[];
  reason: string | null;
  deadline: number | null;
  remaining: number | null;
  messages: Message[];
  rematch: string[];
  drawOfferedBy?: string | null;
  spectators?: number;
  serverTime?: number;
};

export type LobbyRoom = {
  id: string;
  host: string;
  count: number;
  status: "waiting" | "playing";
  spectators: number;
};

export type OnlineUser = {
  id: string;
  name: string;
  status: "idle" | "matching" | "playing" | "waiting";
  profileId?: string;
  score?: number;
};

export type HistoryItem = {
  id: string;
  opponent: string;
  result: string;
  moves: number;
  at: number;
  mode: string;
  sequence?: Move[];
  players?: { name: string }[];
};

export type ServerMatch = {
  id: string;
  players: { id: string; name: string }[];
  winner: string | null;
  moves: Move[];
  at: number;
  reason: string;
};

export type Score = {
  id: string;
  name: string;
  score: number;
  wins: number;
  draws: number;
  losses: number;
  played: number;
  avgOpponentScore: number;
  avgWinMoves: number;
  avgLossMoves: number;
};

export type Account = {
  id: string;
  username: string;
  name: string;
  profileId: string;
};

export type ConnectionStatus =
  | "connecting"
  | "online"
  | "offline"
  | "replaced";

export type Dialog =
  | "auth"
  | "rooms"
  | "history"
  | "leaderboard"
  | "replay"
  | "rules"
  | "resign"
  | "leave"
  | "practice"
  | "onlinePlayers"
  | "rename"
  | null;

export type ClientCommand =
  | { type: "create"; name: string; roomId?: string }
  | { type: "join"; name: string; roomId: string }
  | { type: "match"; name: string }
  | { type: "cancelMatch" }
  | { type: "spectate"; roomId: string }
  | { type: "move"; index: number }
  | { type: "chat"; text: string }
  | { type: "rename"; name: string }
  | { type: "invite"; targetUserId: string; name?: string }
  | { type: "inviteResponse"; invitationId: string; accept: boolean }
  | { type: "drawOffer" }
  | { type: "drawResponse"; accept: boolean }
  | { type: "resign" | "rematch" | "rematchDecline" | "leave" | "stats" };

export type Invitation = {
  id: string;
  fromId: string;
  fromName: string;
  expiresAt: number;
};

export type ServerEvent =
  | {
      type: "welcome";
      id: string;
      name?: string;
      token: string;
      profileId?: string;
      profileToken?: string;
      serverTime: number;
    }
  | {
      type: "lobby";
      rooms: LobbyRoom[];
      online: number;
      matching?: number;
      users?: OnlineUser[];
    }
  | { type: "room"; room: Room }
  | { type: "left" }
  | { type: "matchmaking"; waiting: boolean }
  | { type: "stats"; history?: ServerMatch[]; leaderboard?: Score[] }
  | { type: "renamed"; name: string }
  | {
      type: "invitation";
      id: string;
      fromId: string;
      fromName: string;
      expiresAt: number;
    }
  | { type: "drawOfferReceived"; fromName: string }
  | { type: "notice"; message: string }
  | { type: "error"; message: string };
