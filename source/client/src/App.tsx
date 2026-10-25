import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import InvitePanel from "./InvitePanel";
import {
  chooseBotMove,
  emptyBoard,
  winningLine,
  SIZE,
  type Stone,
} from "../../shared/game.mjs";

type Player = { id: string; name: string; online: boolean };
type Move = { index: number; symbol: "X" | "O" };
type Message = {
  id: string;
  userId: string;
  name: string;
  text: string;
  at: number;
};
type Room = {
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
  serverTime?: number;
};
type LobbyRoom = { id: string; host: string; count: number };
type HistoryItem = {
  id: string;
  opponent: string;
  result: string;
  moves: number;
  at: number;
  mode: string;
};
type Dialog = "rooms" | "history" | "rules" | "resign" | "leave" | "practice" | null;

function stored<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private storage */
  }
}
function practice(name: string): Room {
  return {
    id: "practice",
    round: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    board: emptyBoard(),
    status: "playing",
    turn: "X",
    players: [
      { id: "you", name: name || "Bạn", online: true },
      { id: "bot", name: "Caro Bot", online: true },
    ],
    moves: [],
    winner: null,
    line: [],
    reason: null,
    deadline: null,
    remaining: null,
    messages: [],
    rematch: [],
  };
}
const paths: Record<string, ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </>
  ),
  rooms: (
    <>
      <rect x="3" y="4" width="7" height="7" rx="2" />
      <rect x="14" y="4" width="7" height="7" rx="2" />
      <rect x="3" y="15" width="7" height="6" rx="2" />
      <path d="M14 18h7m-3.5-3.5v7" />
    </>
  ),
  history: (
    <>
      <path d="M3 11a9 9 0 1 1 2.7 7M3 4v7h7M12 7v5l3 2" />
    </>
  ),
  book: (
    <>
      <path d="M12 5v16M12 5C8 2 4 3 2 4v15c4-2 7-1 10 2 3-3 6-4 10-2V4c-3-1-6-2-10 1Z" />
    </>
  ),
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="13" rx="2" />
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
    </>
  ),
  send: (
    <>
      <path d="m21 3-7 18-4-7-7-4 18-7ZM10 14 21 3" />
    </>
  ),
  chat: <path d="M21 11a8 8 0 0 1-8 8H7l-5 3 1-7a8 8 0 1 1 18-4Z" />,
  undo: (
    <>
      <path d="M9 4 3 10l6 6M3 10h11a7 7 0 0 1 7 7v3" />
    </>
  ),
  flag: (
    <>
      <path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  volume: (
    <>
      <path d="m11 4-6 5H2v6h3l6 5V4ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
    </>
  ),
  mute: (
    <>
      <path d="m11 4-6 5H2v6h3l6 5V4ZM16 9l6 6m0-6-6 6" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  bolt: <path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z" />,
  shield: (
    <>
      <path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 3h10v6a5 5 0 0 1-10 0V3ZM7 5H3v3a4 4 0 0 0 5 4m9-7h4v3a4 4 0 0 1-5 4M12 14v6m-4 1h8" />
    </>
  ),
  link: (
    <>
      <path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 2 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" />
    </>
  ),
  exit: (
    <>
      <path d="M9 3H4v18h5m6-14 5 5-5 5m-6-5h11" />
    </>
  ),
  bot: (
    <>
      <rect x="4" y="6" width="16" height="14" rx="4" />
      <path d="M12 2v4M1 11v5m22-5v5M8 16h8" />
      <circle cx="8" cy="11" r=".7" />
      <circle cx="16" cy="11" r=".7" />
    </>
  ),
};
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.grid}
    </svg>
  );
}
function Mark({
  symbol,
  small = false,
}: {
  symbol: "X" | "O";
  small?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`mark mark-${symbol.toLowerCase()} ${small ? "small" : ""}`}
    />
  );
}

export default function App() {
  const [name, setName] = useState(() => stored("caro-name", ""));
  const [local, setLocal] = useState<Room>(() => practice(name));
  const [onlineRoom, setOnlineRoom] = useState<Room | null>(null);
  const [userId, setUserId] = useState("");
  const [connection, setConnection] = useState<
    "connecting" | "online" | "offline" | "replaced"
  >("connecting");
  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [code, setCode] = useState(
    () =>
      new URLSearchParams(location.search)
        .get("room")
        ?.toUpperCase()
        .slice(0, 6) || "",
  );
  const [invitedRoom] = useState(() => {
    const value =
      new URLSearchParams(location.search).get("room")?.toUpperCase() || "";
    return /^[A-F0-9]{6}$/.test(value) ? value : null;
  });
  const [chat, setChat] = useState("");
  const [toast, setToast] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [sound, setSound] = useState(() => stored("caro-sound", false));
  const [history, setHistory] = useState<HistoryItem[]>(() =>
    stored("caro-history", []),
  );
  const [now, setNow] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  const socket = useRef<WebSocket | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const recorded = useRef(new Set<string>());
  const room = onlineRoom || local;
  const isOnline = Boolean(onlineRoom);
  const me = isOnline ? userId : "you";
  const myIndex = room.players.findIndex((p) => p.id === me);
  const mySymbol = myIndex === 1 ? "O" : "X";
  const paused =
    isOnline &&
    room.status === "playing" &&
    room.players.some((p) => !p.online);
  const myTurn = room.status === "playing" && room.turn === mySymbol && !paused;
  const canMove = myTurn && (!isOnline || connection === "online");
  const opponent = room.players.find((p) => p.id !== me);
  const remaining = room.deadline
    ? Math.max(0, Math.ceil((room.deadline - now - offset) / 1000))
    : room.remaining != null
      ? Math.ceil(room.remaining / 1000)
      : 30;
  const lastMove = room.moves.at(-1)?.index;
  const wins = history.filter((h) => h.result === "Thắng").length;

  function notify(message: string) {
    setToast(message);
  }
  function beep() {
    if (!sound) return;
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      const oscillator = audio.current.createOscillator(),
        gain = audio.current.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 510;
      gain.gain.setValueAtTime(0.06, audio.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audio.current.currentTime + 0.1,
      );
      oscillator.connect(gain);
      gain.connect(audio.current.destination);
      oscillator.start();
      oscillator.stop(audio.current.currentTime + 0.1);
    } catch {
      /* audio unavailable */
    }
  }
  function send(data: object) {
    if (socket.current?.readyState !== WebSocket.OPEN) {
      notify("Đang mất kết nối server. Bạn vẫn có thể đấu với máy.");
      return false;
    }
    socket.current.send(JSON.stringify(data));
    return true;
  }

  useEffect(() => {
    let disposed = false,
      retry: ReturnType<typeof setTimeout>;
    function connect() {
      if (disposed) return;
      setConnection("connecting");
      const ws = new WebSocket(
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`,
      );
      socket.current = ws;
      ws.onopen = () => {
        let token = null;
        try {
          token = sessionStorage.getItem("caro-session");
        } catch {
          /* storage unavailable */
        }
        ws.send(JSON.stringify({ type: "hello", token }));
      };
      ws.onmessage = (event) => {
        if (disposed) return;
        const data = JSON.parse(event.data);
        if (data.type === "welcome") {
          try {
            sessionStorage.setItem("caro-session", data.token);
          } catch {
            /* storage unavailable */
          }
          setUserId(data.id);
          setConnection("online");
          setOffset(data.serverTime - Date.now());
          setOnlineRoom(null);
        } else if (data.type === "lobby") {
          setRooms(data.rooms);
          setOnlineCount(data.online);
        } else if (data.type === "room") setOnlineRoom(data.room);
        else if (data.type === "left") setOnlineRoom(null);
        else if (data.type === "error") notify(data.message);
      };
      ws.onclose = (event) => {
        if (disposed) return;
        if (event.code === 4001) {
          setConnection("replaced");
          return;
        }
        setConnection("offline");
        retry = setTimeout(connect, 1800);
      };
      ws.onerror = () => ws.close();
    }
    connect();
    return () => {
      disposed = true;
      clearTimeout(retry);
      socket.current?.close();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    save("caro-name", name);
  }, [name]);
  useEffect(() => {
    save("caro-sound", sound);
  }, [sound]);
  useEffect(() => {
    const container = chatEnd.current?.parentElement;
    container?.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [room.messages.length]);
  useEffect(() => {
    if (isOnline || local.status !== "playing" || local.turn !== "O") return;
    const timer = setTimeout(() => {
      setLocal((current) => {
        if (current.status !== "playing" || current.turn !== "O")
          return current;
        return applyMove(
          current,
          chooseBotMove([...current.board]),
          "O",
          "bot",
        );
      });
    }, 480);
    return () => clearTimeout(timer);
  }, [local, isOnline]);
  useEffect(() => {
    if (room.status !== "finished") return;
    const id = `${room.round}-${me}`;
    if (recorded.current.has(id)) return;
    recorded.current.add(id);
    const item = {
      id,
      opponent: opponent?.name || "Đối thủ",
      result: !room.winner ? "Hòa" : room.winner === me ? "Thắng" : "Thua",
      moves: room.moves.length,
      at: Date.now(),
      mode: isOnline ? "Online" : "Đấu với máy",
    };
    setHistory((current) => {
      const next = [item, ...current.filter((h) => h.id !== id)].slice(0, 30);
      save("caro-history", next);
      return next;
    });
  }, [room.status, room.winner, room.reason]);
  useEffect(() => {
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const modal = document.querySelector<HTMLElement>(".modal");
    const focusable = () => [
      ...(modal?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input, a[href]",
      ) || []),
    ];
    focusable()[0]?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") setDialog(null);
      if (event.key === "Tab") {
        const items = focusable(),
          first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      previous?.focus();
    };
  }, [dialog]);

  function applyMove(
    current: Room,
    index: number,
    symbol: "X" | "O",
    playerId: string,
  ): Room {
    if (index < 0 || current.board[index]) return current;
    const board = [...current.board];
    board[index] = symbol;
    const moves = [...current.moves, { index, symbol }];
    const line = winningLine(board, index, symbol);
    const finished = Boolean(line.length) || moves.length === SIZE * SIZE;
    return {
      ...current,
      board,
      moves,
      line,
      turn: symbol === "X" ? "O" : "X",
      status: finished ? "finished" : "playing",
      winner: line.length ? playerId : null,
      reason: finished ? (line.length ? "five" : "draw") : null,
    };
  }
  function move(index: number) {
    if (!canMove || room.board[index]) return;
    beep();
    if (isOnline) send({ type: "move", index });
    else setLocal((current) => applyMove(current, index, "X", "you"));
  }
  function enterRoom(roomId?: string) {
    if (!name.trim()) {
      notify("Nhập tên của bạn ở thẻ Kết nối bạn bè nhé.");
      document.getElementById("player-name")?.focus();
      return;
    }
    if (isOnline) {
      notify("Hãy rời phòng hiện tại trước khi vào phòng khác.");
      return;
    }
    if (roomId != null && !/^[A-F0-9]{6}$/.test(roomId.trim().toUpperCase())) {
      notify("Mã phòng gồm 6 ký tự, ví dụ A1B2C3.");
      return;
    }
    if (
      send({
        type: roomId == null ? "create" : "join",
        name: name.trim(),
        roomId,
      })
    )
      setDialog(null);
  }
  function newPractice() {
    recorded.current.clear();
    setLocal(practice(name));
  }
  function startPractice() {
    if (isOnline && !send({ type: "leave" })) return;
    newPractice();
    setDialog(null);
  }
  function choosePractice() {
    if (isOnline && room.status === "playing") setDialog("practice");
    else if (isOnline) startPractice();
    else setDialog(null);
  }
  function undo() {
    if (isOnline || !local.moves.length || local.status === "finished") return;
    const moves = local.moves.slice(
      0,
      local.moves.at(-1)?.symbol === "O" ? -2 : -1,
    );
    const board = emptyBoard();
    moves.forEach((m) => {
      board[m.index] = m.symbol;
    });
    setLocal({ ...local, moves, board, turn: "X" });
  }
  function submitChat(event: FormEvent) {
    event.preventDefault();
    if (chat.trim() && send({ type: "chat", text: chat.trim() })) setChat("");
  }
  function boardKeyboard(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const delta: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -SIZE,
      ArrowDown: SIZE,
    };
    if (event.key in delta) {
      event.preventDefault();
      const next = Math.max(
        0,
        Math.min(SIZE * SIZE - 1, index + delta[event.key]),
      );
      document
        .querySelector<HTMLButtonElement>(`[data-cell="${next}"]`)
        ?.focus();
    }
  }
  const resultText =
    room.status === "finished"
      ? !room.winner
        ? "Một ván hòa đầy cân sức!"
        : room.winner === me
          ? "Bạn đã chiến thắng!"
          : `${opponent?.name || "Đối thủ"} đã chiến thắng`
      : "";
  const reasonText: Record<string, string> = {
    five: "5 quân liên tiếp — một nước đi thật đẹp.",
    draw: "Bàn cờ đã kín. Hẹn nhau ở ván tiếp theo!",
    timeout: "Ván đấu kết thúc do hết thời gian.",
    resign: "Ván đấu kết thúc do đầu hàng.",
    leave: "Đối thủ đã rời phòng hoặc mất kết nối quá 30 giây.",
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Caro Club trang chủ">
          <span className="brand-logo">
            <Mark symbol="X" />
            <Mark symbol="O" />
          </span>
          <span>
            caro<span className="brand-light">club</span>
            <small>PLAY. CONNECT. REPEAT.</small>
          </span>
        </a>
        <div className="nav-label">KHÔNG GIAN CỦA BẠN</div>
        <nav aria-label="Điều hướng chính">
          <button
            className={!dialog ? "nav-item active" : "nav-item"}
            onClick={() => setDialog(null)}
          >
            <Icon name="grid" />
            Bàn cờ
            <span className="nav-active-dot" />
          </button>
          <button
            className={`nav-item ${dialog === "rooms" ? "active" : ""}`}
            onClick={() => setDialog("rooms")}
          >
            <Icon name="rooms" />
            Phòng chơi<span className="count-badge">{rooms.length}</span>
          </button>
          <button
            className={`nav-item ${dialog === "history" ? "active" : ""}`}
            onClick={() => setDialog("history")}
          >
            <Icon name="history" />
            Lịch sử đấu
          </button>
          <button
            className={`nav-item ${dialog === "rules" ? "active" : ""}`}
            onClick={() => setDialog("rules")}
          >
            <Icon name="book" />
            Cách chơi
          </button>
        </nav>
        <div className="sidebar-tip">
          <span className="tip-symbol">✳</span>
          <h3>
            Chậm một nhịp.
            <br />
            Hay một nước.
          </h3>
          <p>
            Mỗi ván cờ là một cơ hội
            <br />
            để nhìn xa hơn.
          </p>
          <span className="tip-dots">○ &nbsp; × &nbsp; ○</span>
        </div>
        <div className="sidebar-bottom">
          <div className="avatar">{(name || "B").charAt(0).toUpperCase()}</div>
          <div>
            <strong>{name || "Người chơi mới"}</strong>
            <span>Sẵn sàng cho một ván cờ</span>
          </div>
          <span className="green-dot" />
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Không gian chơi <Icon name="chevron" size={14} />
            <strong>Bàn cờ Caro</strong>
          </div>
          <div
            className={`connection ${connection === "online" ? "" : "disconnected"}`}
          >
            <span className="green-dot" />
            {connection === "online"
              ? "Server đang kết nối"
              : connection === "replaced"
                ? "Phiên đã mở ở nơi khác"
                : connection === "offline"
                  ? "Đang kết nối lại…"
                  : "Đang kết nối…"}
          </div>
          <span className="demo-label">DEMO · NHÓM 09</span>
        </header>
        <main>
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span /> CHƠI CỜ, KẾT NỐI BẠN BÈ
              </div>
              <h1>
                Một nước cờ. <span>Một kết nối.</span>
              </h1>
              <p>Gác lại một chút bận rộn, cùng nhau làm một ván Caro.</p>
            </div>
            <button
              className="button secondary room-browse"
              onClick={() => setDialog("rooms")}
            >
              <Icon name="rooms" size={18} />
              Khám phá phòng
              <Icon name="arrow" size={17} />
            </button>
          </section>

        <section className="mode-picker" aria-label="Chọn chế độ chơi">
          <div className="mode-options">
            <button type="button" className={`mode-option ${!isOnline ? "selected" : ""}`} aria-pressed={!isOnline} onClick={choosePractice}>
              <Icon name="bot" size={20} /><span>Đấu với máy<small>Luyện tập cùng Caro Bot</small></span>
            </button>
            <button type="button" className={`mode-option ${isOnline ? "selected" : ""}`} aria-pressed={isOnline} onClick={() => {
              if (isOnline) setDialog(null);
              else { setDialog(null); document.getElementById("player-name")?.focus(); }
            }}>
              <Icon name="link" size={20} /><span>Đấu online<small>Tạo phòng, mời bạn bằng QR</small></span>
            </button>
          </div>
          <p>{isOnline ? "Bạn đang ở phòng online. Chọn Đấu với máy để chuyển sang luyện tập." : "Bạn cầm X và đi trước. Bấm vào ô trống để đánh, Caro Bot sẽ tự đáp lại."}</p>
        </section>
        {!isOnline && invitedRoom && (
            <section
              className="invitation-banner"
              aria-label="Lời mời vào phòng"
            >
              <div>
                <strong>Bạn được mời vào phòng #{invitedRoom}</strong>
                <p>Nhập tên để cùng bạn bè bắt đầu ván Caro.</p>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  enterRoom(invitedRoom);
                }}
              >
                <input
                  aria-label="Tên để tham gia phòng được mời"
                  placeholder="Tên của bạn"
                  value={name}
                  maxLength={24}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="nickname"
                />
                <button
                  className="button primary"
                  disabled={connection !== "online" || !name.trim()}
                >
                  Vào phòng
                </button>
              </form>
            </section>
          )}
          <div className="game-layout">
            <section className="game-card" aria-label="Khu vực chơi cờ">
              <div className="game-card-top">
                <div className="board-title">
                  <span className="section-icon">
                    <Icon name="grid" size={19} />
                  </span>
                  <div>
                    <h2>Bàn cờ của bạn</h2>
                    <span>
                      {isOnline
                        ? `PHÒNG #${room.id}`
                        : "MỘT VÁN NHẸ NHÀNG, MỘT NGÀY THẬT VUI"}
                    </span>
                  </div>
                </div>
                <span className={`mode-badge ${isOnline ? "online-mode" : ""}`}>
                  <Icon name={isOnline ? "link" : "bot"} size={15} />
                  {isOnline ? "Đấu online" : "Đấu với máy"}
                </span>
              </div>
              <div className="player-strip">
                {[0, 1].map((index) => {
                  const player = room.players[index],
                    symbol = index === 0 ? "X" : "O";
                  return (
                    <div
                      key={index}
                      className={`player ${room.turn === symbol && room.status === "playing" ? "current" : ""}`}
                    >
                      <div
                        className={`player-avatar ${index === 1 ? "teal" : ""}`}
                      >
                        {player?.id === "bot" ? (
                          <Icon name="bot" size={23} />
                        ) : (
                          (player?.name || "?").charAt(0).toUpperCase()
                        )}
                        <span
                          className={
                            player?.online ? "online-dot" : "offline-dot"
                          }
                        />
                      </div>
                      <div className="player-info">
                        <strong>
                          {player?.id === me
                            ? name || "Bạn"
                            : player?.name || "Đang chờ đối thủ"}
                          {player?.id === me && <small> BẠN</small>}
                        </strong>
                        <span>
                          {!player
                            ? "Mời một người bạn tham gia"
                            : !player.online
                              ? "Đang mất kết nối"
                              : room.status === "finished"
                                ? room.winner === player.id
                                  ? "Người chiến thắng"
                                  : "Đã kết thúc"
                                : room.turn === symbol
                                  ? index === 1 && !isOnline
                                    ? "Đang suy nghĩ…"
                                    : "Đang đến lượt"
                                  : "Sẵn sàng"}
                        </span>
                      </div>
                      <Mark symbol={symbol} small />
                    </div>
                  );
                })}
                <span className="versus">VS</span>
              </div>

              <div
                className={`turn-bar ${paused ? "warning" : ""}`}
                role="status"
              >
                <span className="turn-description">
                  <span className="pulse-dot" />
                  {room.status === "waiting"
                    ? "Phòng đã sẵn sàng. Mời bạn bè vào chơi!"
                    : room.status === "finished"
                      ? resultText
                      : paused
                        ? "Tạm dừng · chờ đối thủ kết nối lại (30 giây)"
                        : myTurn
                          ? "Đến lượt bạn. Nước đi tiếp theo là gì?"
                          : isOnline
                            ? "Đối thủ đang suy nghĩ…"
                            : "Caro Bot đang suy nghĩ…"}
                </span>
                <span
                  className={`timer ${isOnline && remaining <= 10 ? "urgent" : ""}`}
                >
                  <Icon name="clock" size={15} />
                  {room.status === "finished"
                    ? "Đã kết thúc"
                    : room.status === "waiting"
                      ? "Chờ đối thủ"
                      : isOnline
                        ? `${remaining}s`
                        : "Không giới hạn"}
                </span>
              </div>

              <div className="board-area">
                <div className="board-coordinate-top">
                  <span />
                  {Array.from({ length: SIZE }, (_, i) => (
                    <span key={i}>{String.fromCharCode(65 + i)}</span>
                  ))}
                </div>
                <div className="board-with-labels">
                  <div className="board-coordinate-side">
                    {Array.from({ length: SIZE }, (_, i) => (
                      <span key={i}>{i + 1}</span>
                    ))}
                  </div>
                  <div
                    className={`board ${canMove ? "playable" : ""}`}
                    role="group"
                    aria-label="Bàn cờ 15 hàng, 15 cột. Dùng phím mũi tên để di chuyển, Enter để đánh."
                  >
                    {room.board.map((stone, index) => (
                      <button
                        key={index}
                        data-cell={index}
                        tabIndex={index === (lastMove ?? 112) ? 0 : -1}
                        aria-label={`${String.fromCharCode(65 + (index % SIZE))}${Math.floor(index / SIZE) + 1}${stone ? `: ${stone}` : ": trống"}`}
                        aria-disabled={Boolean(stone) || !canMove}
                        className={`cell ${stone ? "occupied" : ""} ${room.line.includes(index) ? "winning" : ""} ${lastMove === index ? "last-move" : ""} ${index === 112 && !room.moves.length ? "center-cell" : ""}`}
                        onClick={() => move(index)}
                        onKeyDown={(event) => boardKeyboard(event, index)}
                      >
                        {stone ? (
                          <Mark symbol={stone} />
                        ) : (
                          <span
                            className={`ghost ghost-${mySymbol.toLowerCase()}`}
                          />
                        )}
                        {[48, 56, 112, 168, 176].includes(index) && !stone && (
                          <span className="board-star" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {room.status === "finished" && (
                <div className="result-panel">
                  <span className="result-icon">
                    <Icon name="trophy" size={25} />
                  </span>
                  <div>
                    <strong>{resultText}</strong>
                    <p>{reasonText[room.reason || "five"]}</p>
                  </div>
                  <button
                    className="button primary"
                    disabled={isOnline && room.rematch.includes(me)}
                    onClick={() =>
                      isOnline ? send({ type: "rematch" }) : newPractice()
                    }
                  >
                    <Icon name="undo" size={16} />
                    {isOnline && room.rematch.includes(me)
                      ? "Đợi đối thủ…"
                      : "Chơi lại"}
                  </button>
                  {isOnline &&
                    room.rematch.length > 0 &&
                    !room.rematch.includes(me) && (
                      <small>Đối thủ muốn chơi ván mới!</small>
                    )}
                </div>
              )}

              <div className="board-bottom">
                <span>
                  <span className="tiny-dot" />
                  {room.moves.length.toString().padStart(2, "0")} nước đi
                </span>
                <span>
                  15 × 15 <i /> 5 quân liên tiếp
                </span>
                <button
                  className="icon-button"
                  title={sound ? "Tắt âm thanh" : "Bật âm thanh"}
                  aria-label={sound ? "Tắt âm thanh" : "Bật âm thanh"}
                  onClick={() => setSound(!sound)}
                >
                  <Icon name={sound ? "volume" : "mute"} size={18} />
                </button>
              </div>
              <div className="game-actions">
                <button
                  className="text-button"
                  disabled={
                    isOnline || !room.moves.length || room.status === "finished"
                  }
                  onClick={undo}
                >
                  <Icon name="undo" size={17} />
                  Đi lại
                </button>
                <span className="action-note">
                  {isOnline
                    ? "Nước đi được xác nhận bởi server"
                    : "Thử chiến thuật, tự tin hơn mỗi ván"}
                </span>
                <button
                  className="text-button resign"
                  disabled={room.status !== "playing"}
                  onClick={() => setDialog("resign")}
                >
                  <Icon name="flag" size={17} />
                  Đầu hàng
                </button>
              </div>
            </section>

            <aside className="right-column">
              <section className="connect-card">
                <div className="connect-decoration">
                  ×<span>○</span>
                </div>
                <span className="card-overline">NIỀM VUI KHI CÓ ĐÔI</span>
                <h2>Rủ bạn, đấu một ván.</h2>
                <p>
                  Một mã phòng. Hai người chơi.
                  <br />
                  Vô vàn nước cờ thú vị.
                </p>
                <label className="field-label" htmlFor="player-name">
                  Tên của bạn
                </label>
                <input
                  id="player-name"
                  className="name-input"
                  maxLength={24}
                  value={name}
                  placeholder="Bạn muốn được gọi là gì?"
                  onChange={(e) => setName(e.target.value)}
                  disabled={isOnline}
                  autoComplete="nickname"
                />
                {isOnline ? (
                  <>
                    <InvitePanel roomId={room.id} notify={notify} />
                    <button
                      className="leave-button"
                      onClick={() => setDialog("leave")}
                    >
                      <Icon name="exit" size={15} />
                      Rời phòng
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="button white full create-button"
                      disabled={connection !== "online"}
                      onClick={() => enterRoom()}
                    >
                      <Icon name="plus" size={18} />
                      Tạo phòng mới
                      <Icon name="arrow" size={17} />
                    </button>
                    <div className="or-divider">
                      <span />
                      hoặc tham gia phòng
                      <span />
                    </div>
                    <form
                      className="join-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        enterRoom(code);
                      }}
                    >
                      <input
                        aria-label="Mã phòng"
                        placeholder="Nhập mã phòng"
                        value={code}
                        onChange={(e) =>
                          setCode(
                            e.target.value
                              .toUpperCase()
                              .replace(/[^A-F0-9]/g, "")
                              .slice(0, 6),
                          )
                        }
                        maxLength={6}
                      />
                      <button
                        type="submit"
                        title="Vào phòng"
                        aria-label="Vào phòng"
                        disabled={connection !== "online" || code.length !== 6}
                      >
                        <Icon name="arrow" size={20} />
                      </button>
                    </form>
                  </>
                )}
                <div className="connect-footnote">
                  <Icon name="shield" size={13} />
                  Không cần tài khoản · Chơi ngay
                </div>
              </section>

              <section className="chat-card">
                <div className="chat-heading">
                  <h2>
                    <Icon name="chat" size={18} />
                    Trò chuyện
                  </h2>
                  <span className={isOnline ? "chat-live" : ""}>
                    {isOnline ? "TRONG PHÒNG" : "CÙNG BẠN BÈ"}
                  </span>
                </div>
                <div
                  className="chat-messages"
                  role="log"
                  aria-label="Tin nhắn trong phòng"
                  aria-live="polite"
                >
                  {room.messages.length ? (
                    room.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`message ${message.userId === me ? "mine" : ""}`}
                      >
                        <div className="message-meta">
                          <strong>
                            {message.userId === me ? "Bạn" : message.name}
                          </strong>
                          <time>
                            {new Date(message.at).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                        </div>
                        <p>{message.text}</p>
                      </div>
                    ))
                  ) : (
                    <div className="empty-chat">
                      <span>
                        <Icon name="chat" size={28} />
                        <span className="chat-spark">✧</span>
                      </span>
                      <strong>Một lời chào, thêm một người bạn.</strong>
                      <p>
                        {isOnline
                          ? "Gửi lời chào để bắt đầu câu chuyện nhé."
                          : "Tạo hoặc tham gia phòng để trò chuyện cùng đối thủ nhé."}
                      </p>
                    </div>
                  )}
                  <div ref={chatEnd} />
                </div>
                <form className="chat-form" onSubmit={submitChat}>
                  <input
                    aria-label="Nội dung tin nhắn"
                    value={chat}
                    onChange={(e) => setChat(e.target.value)}
                    maxLength={300}
                    placeholder={
                      isOnline
                        ? "Gửi một lời chào…"
                        : "Vào phòng để trò chuyện…"
                    }
                    disabled={!isOnline || connection !== "online"}
                  />
                  <button
                    aria-label="Gửi tin nhắn"
                    type="submit"
                    disabled={
                      !isOnline || !chat.trim() || connection !== "online"
                    }
                  >
                    <Icon name="send" size={17} />
                  </button>
                </form>
              </section>

              <button className="rules-link" onClick={() => setDialog("rules")}>
                <span className="rules-link-icon">
                  <Icon name="book" size={20} />
                </span>
                <span>
                  <strong>Lần đầu chơi Caro?</strong>
                  <small>30 giây để nắm luật chơi</small>
                </span>
                <Icon name="arrow" size={17} />
              </button>
            </aside>
          </div>

          <section className="below-grid">
            <div className="community-status">
              <span className="online-avatars">
                <span>N</span>
                <span>T</span>
                <span>Q</span>
              </span>
              <div>
                <strong>{onlineCount} người đang kết nối</strong>
                <p>Một cộng đồng nhỏ, những ván cờ vui.</p>
              </div>
              <span className="green-dot" />
            </div>
            <div className="personal-stat">
              <span className="stat-icon">
                <Icon name="trophy" size={21} />
              </span>
              <strong>
                {wins}
                <small>Ván thắng</small>
              </strong>
              <span className="stat-divider" />
              <strong>
                {history.length}
                <small>Ván đã chơi</small>
              </strong>
              <button
                className="icon-button"
                aria-label="Xem lịch sử đấu"
                onClick={() => setDialog("history")}
              >
                <Icon name="arrow" size={18} />
              </button>
            </div>
          </section>
          <footer>
            <span>
              <span className="footer-brand">caroclub</span> Một chút chiến
              thuật. Một chút kết nối.
            </span>
            <span>
              Lập trình mạng <span className="footer-dot">·</span> Nhóm 09{" "}
              <span className="footer-dot">·</span> HTTP + WebSocket
            </span>
          </footer>
        </main>
      </div>

      {toast && (
        <div className="toast" role="status">
          <Icon name="bolt" size={18} />
          {toast}
          <button aria-label="Đóng thông báo" onClick={() => setToast("")}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      {dialog && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDialog(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-heading">
              <h2 id="modal-title">
                {dialog === "rooms"
                  ? "Tìm bạn cùng chơi"
                  : dialog === "history"
                    ? "Những ván cờ đã qua"
                    : dialog === "rules"
                      ? "Caro, dễ chơi mà khó đoán."
                      : dialog === "resign"
                        ? "Dừng ván cờ tại đây?"
                      : dialog === "practice"
                        ? "Chuyển sang đấu với máy?"
                        : "Bạn muốn rời phòng?"}
              </h2>
              <button
                className="icon-button"
                aria-label="Đóng"
                onClick={() => setDialog(null)}
              >
                <Icon name="close" />
              </button>
            </div>
            {dialog === "rooms" && (
              <>
                <p className="modal-description">
                  Chọn một phòng đang chờ, hoặc tạo phòng và gửi mã cho bạn bè.
                </p>
                {rooms.length ? (
                  <div className="room-list">
                    {rooms.map((item) => (
                      <div className="room-row" key={item.id}>
                        <span className="room-avatar">
                          {item.host.charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <strong>Phòng của {item.host}</strong>
                          <small>
                            #{item.id} · {item.count}/2 người chơi
                          </small>
                        </div>
                        <button
                          className="button primary"
                          disabled={isOnline || connection !== "online"}
                          onClick={() => enterRoom(item.id)}
                        >
                          Tham gia
                          <Icon name="arrow" size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="modal-empty">
                    <Icon name="rooms" size={36} />
                    <h3>Chiếc bàn đầu tiên đang chờ bạn.</h3>
                    <p>
                      Chưa có phòng trống. Hãy tạo phòng và rủ một người bạn!
                    </p>
                  </div>
                )}
                <button
                  className="button primary full"
                  disabled={isOnline || connection !== "online"}
                  onClick={() => enterRoom()}
                >
                  <Icon name="plus" size={18} />
                  Tạo phòng của bạn
                </button>
              </>
            )}
            {dialog === "history" && (
              <>
                <p className="modal-description">
                  Lưu tối đa 30 ván gần nhất trên trình duyệt này.
                </p>
                {history.length ? (
                  <div className="history-list">
                    {history.map((item) => (
                      <div className="history-row" key={item.id}>
                        <span
                          className={`result-badge ${item.result === "Thắng" ? "win" : item.result === "Thua" ? "loss" : ""}`}
                        >
                          {item.result}
                        </span>
                        <div>
                          <strong>vs. {item.opponent}</strong>
                          <small>
                            {item.mode} · {item.moves} nước đi
                          </small>
                        </div>
                        <time>
                          {new Date(item.at).toLocaleString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="modal-empty">
                    <Icon name="history" size={36} />
                    <h3>Câu chuyện của bạn bắt đầu từ đây.</h3>
                    <p>Hoàn thành một ván cờ để lưu dấu hành trình.</p>
                  </div>
                )}
              </>
            )}
            {dialog === "rules" && (
              <>
                <p className="modal-description">
                  Hai người, hai ký hiệu, một mục tiêu: nối 5 quân liên tiếp.
                </p>
                <ol className="rules-list">
                  <li>
                    <strong>X đi trước, O đi sau.</strong>
                    <p>
                      Luân phiên đặt một quân vào ô trống trên bàn cờ 15 × 15.
                    </p>
                  </li>
                  <li>
                    <strong>Nối 5 quân để chiến thắng.</strong>
                    <p>
                      Theo hàng ngang, dọc hoặc chéo. Bản demo tính thắng khi có
                      từ 5 quân liên tiếp, kể cả bị chặn hai đầu.
                    </p>
                  </li>
                  <li>
                    <strong>Mỗi lượt online có 30 giây.</strong>
                    <p>
                      Hết giờ hoặc đầu hàng sẽ thua ván. Mất kết nối được tạm
                      dừng tối đa 30 giây để kết nối lại.
                    </p>
                  </li>
                  <li>
                    <strong>Chơi theo cách của bạn.</strong>
                    <p>
                      Đấu với máy để luyện tập và đi lại. Tạo phòng rồi mở link
                      mời ở trình duyệt khác hoặc tab độc lập để đấu online. Hai
                      người đồng ý để chơi lại và đổi bên.
                    </p>
                  </li>
                </ol>
                <div className="rule-note">
                  <Icon name="shield" size={18} />
                  <span>
                    Phòng và chat lưu trong RAM, sẽ xóa khi server khởi động
                    lại. Tên hiển thị tự chọn, không có đăng nhập. Máy dùng
                    chiến thuật cơ bản.
                  </span>
                </div>
                <button
                  className="button primary full"
                  onClick={() => setDialog(null)}
                >
                  Mình sẵn sàng rồi
                  <Icon name="arrow" size={18} />
                </button>
              </>
            )}
            {(dialog === "resign" || dialog === "leave" || dialog === "practice") && (
              <>
                <p className="modal-description">
                  {dialog === "practice"
                    ? "Rời ván online đang chơi sẽ tính là thua. Sau đó bạn sẽ bắt đầu một ván mới với Caro Bot."
                    : dialog === "resign"
                    ? "Đầu hàng sẽ tính là thua ván này. Bạn có thể bắt đầu một ván mới sau đó."
                    : room.status === "playing"
                      ? "Rời phòng trong lúc chơi sẽ tính là thua. Đối thủ vẫn có thể xem kết quả ván đấu."
                      : "Bạn sẽ quay về bàn cờ luyện tập với máy."}
                </p>
                <div className="confirm-actions">
                  <button
                    className="button secondary"
                    onClick={() => setDialog(null)}
                  >
                    Ở lại chơi
                  </button>
                  <button
                    className="button danger"
                    onClick={() => {
                      if (dialog === "practice") { startPractice(); return; }
                      if (dialog === "leave") send({ type: "leave" });
                      else if (isOnline) send({ type: "resign" });
                      else
                        setLocal((current) => ({
                          ...current,
                          status: "finished",
                          winner: "bot",
                          reason: "resign",
                        }));
                      setDialog(null);
                    }}
                  >
                    {dialog === "practice" ? "Chuyển sang đấu với máy" : dialog === "leave" ? "Rời phòng" : "Đầu hàng"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
