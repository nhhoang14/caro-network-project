import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import InvitePanel from "./InvitePanel";
import OnlinePanel from "./OnlinePanel";
import ReplayPanel, { type Replay } from "./ReplayPanel";
import GameCard from "./components/GameCard";
import { Icon, Mark } from "./components/GamePrimitives";
import { applyLocalMove, createPracticeRoom } from "./game/practice";
import { useCaroSocket } from "./hooks/useCaroSocket";
import { loadStored, saveStored } from "./lib/storage";
import { authenticate, endSession, getCurrentAccount } from "./services/authApi";
import type { Account, Dialog, HistoryItem, Room } from "./types";
import {
  chooseBotMove,
  emptyBoard,
  SIZE,
} from "../../shared/game.mjs";

export default function App() {
  const [name, setName] = useState(() => loadStored("caro-name", ""));
  const [local, setLocal] = useState<Room>(() => createPracticeRoom(name));
  const [account, setAccount] = useState<Account | null>(null);
  const [accountChecked, setAccountChecked] = useState(false);
  const [guestNameReady, setGuestNameReady] = useState(false);
  const [playMode, setPlayMode] = useState<"practice" | "online">(() =>
    new URLSearchParams(location.search).has("room") ? "online" : "practice",
  );
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [replaySource, setReplaySource] = useState<Replay | null>(null);
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
  const [renameInput, setRenameInput] = useState("");
  const [sound, setSound] = useState(() => loadStored("caro-sound", false));
  const [history, setHistory] = useState<HistoryItem[]>(() =>
    loadStored("caro-history", []),
  );
  const [now, setNow] = useState(Date.now());
  const audio = useRef<AudioContext | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const recorded = useRef(new Set<string>());
  const {
    onlineRoom,
    userId,
    connection,
    rooms,
    onlineUsers,
    onlineCount,
    matchingCount,
    matching,
    serverHistory,
    leaderboard,
    profileId,
    clockOffset,
    invitation,
    setInvitation,
    drawOfferFrom,
    setDrawOfferFrom,
    send,
    reconnect,
    resetServerData,
  } = useCaroSocket(setToast);
  const room = onlineRoom || local;
  const isOnline = Boolean(onlineRoom);
  const me = isOnline ? userId : "you";
  const myIndex = room.players.findIndex((p) => p.id === me);
  const isSpectator = isOnline && myIndex === -1;
  const mySymbol = myIndex === 1 ? "O" : "X";
  const paused =
    isOnline &&
    room.status === "playing" &&
    room.players.some((p) => !p.online);
  const myTurn = !isSpectator && room.status === "playing" && room.turn === mySymbol && !paused;
  const canMove = myTurn && (!isOnline || connection === "online");
  const opponent = room.players.find((p) => p.id !== me);
  const remaining = room.deadline
    ? Math.max(0, Math.ceil((room.deadline - now - clockOffset) / 1000))
    : room.remaining != null
      ? Math.ceil(room.remaining / 1000)
      : 30;
  const localGames = history.filter((h) => h.mode !== "Online");
  const wins = localGames.filter((h) => h.result === "Thắng").length;
  const myScore = leaderboard.find((score) => score.id === profileId);
  const playerReady = Boolean(account) || guestNameReady;

  function notify(message: string) {
    setToast(message);
  }
  useEffect(() => {
    let active = true;
    getCurrentAccount()
      .then((current) => {
        if (active && current) {
          setAccount(current);
          setName(current.name);
          setLocal(createPracticeRoom(current.name));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setAccountChecked(true);
      });
    return () => { active = false; };
  }, []);
  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    if (isOnline) { setAuthError("Hãy rời phòng trước khi đổi tài khoản."); return; }
    setAuthBusy(true);
    setAuthError("");
    try {
      const next = await authenticate(authMode, authUsername, authPassword);
      setAccount(next);
      setName(next.name);
      setGuestNameReady(true);
      recorded.current.clear();
      setLocal(createPracticeRoom(next.name));
      resetServerData();
      setAuthPassword("");
      setDialog(null);
      reconnect();
      notify(authMode === "register" ? "Đã tạo tài khoản và đăng nhập." : "Đăng nhập thành công.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Không thể kết nối server.");
    } finally { setAuthBusy(false); }
  }
  async function logout() {
    if (isOnline && room.status === "playing") {
      setAuthError("Hãy kết thúc hoặc rời ván đang chơi trước khi đăng xuất.");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    try {
      if (isOnline) send({ type: "leave" });
      await endSession();
      setAccount(null);
      setName("");
      setGuestNameReady(false);
      recorded.current.clear();
      setLocal(createPracticeRoom(""));
      setPlayMode("practice");
      resetServerData(true);
      setDialog(null);
      reconnect();
      notify("Đã đăng xuất và đặt lại bàn cờ. Hãy đặt tên để tiếp tục chơi.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Không thể kết nối server.");
    } finally { setAuthBusy(false); }
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
    saveStored("caro-name", name);
  }, [name]);
  useEffect(() => {
    saveStored("caro-sound", sound);
  }, [sound]);
  useEffect(() => {
    if (onlineRoom) setPlayMode("online");
  }, [onlineRoom]);
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
        return applyLocalMove(
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
    if (room.status !== "finished" || isSpectator) return;
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
      sequence: room.moves.map((move) => ({ ...move })),
      players: room.players.map((player) => ({ name: player.name })),
    };
    setHistory((current) => {
      const next = [item, ...current.filter((h) => h.id !== id)].slice(0, 30);
      saveStored("caro-history", next);
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

  function move(index: number) {
    if (!canMove || room.board[index]) return;
    beep();
    if (isOnline) send({ type: "move", index });
    else setLocal((current) => applyLocalMove(current, index, "X", "you"));
  }
  function enterRoom(roomId?: string) {
    if (!name.trim()) {
      notify("Nhập tên của bạn ở thẻ Kết nối bạn bè nhé.");
      document.getElementById("player-name")?.focus();
      return;
    }
    if (isOnline || matching) {
      notify("Hãy rời phòng hiện tại trước khi vào phòng khác.");
      return;
    }
    if (roomId != null && !/^[A-F0-9]{6}$/.test(roomId.trim().toUpperCase())) {
      notify("Mã phòng gồm 6 ký tự, ví dụ A1B2C3.");
      return;
    }
    const command = roomId == null
      ? { type: "create" as const, name: name.trim() }
      : { type: "join" as const, name: name.trim(), roomId };
    if (send(command)) {
      setPlayMode("online");
      setDialog(null);
    }
  }
  function newPractice() {
    recorded.current.clear();
    setLocal(createPracticeRoom(name));
  }
  function startPractice() {
    if (isOnline && !send({ type: "leave" })) return;
    newPractice();
    setPlayMode("practice");
    setDialog(null);
  }
  function choosePractice() {
    if (isOnline && room.status === "playing" && !isSpectator) setDialog("practice");
    else if (isOnline) startPractice();
    else {
      setPlayMode("practice");
      setDialog(null);
    }
  }
  function chooseOnline() {
    setPlayMode("online");
    setDialog(null);
  }
  function openRooms() {
    setPlayMode("online");
    setDialog(playerReady ? "rooms" : null);
  }
  function confirmGuestName(event: FormEvent) {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) {
      notify("Hãy nhập tên để bắt đầu chơi.");
      document.getElementById("online-guest-name")?.focus();
      return;
    }
    setName(nextName);
    setGuestNameReady(true);
    recorded.current.clear();
    setLocal(createPracticeRoom(nextName));
  }
  function findMatch() {
    if (!name.trim()) { notify("Nhập tên để tìm đối thủ."); document.getElementById("player-name")?.focus(); return; }
    if (isOnline) { notify("Hãy rời phòng hiện tại trước."); return; }
    if (send({ type: matching ? "cancelMatch" : "match", name: name.trim() })) {
      setPlayMode("online");
      setDialog(null);
    }
  }
  function openReplay(replay: Replay) {
    setReplaySource(replay);
    setDialog("replay");
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
  const resultText = isSpectator ? (room.winner ? `${room.players.find((p) => p.id === room.winner)?.name || "Người chơi"} chiến thắng!` : "Ván đấu hòa") :
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
            <span className="nav-text">Bàn cờ</span>
            <span className="nav-active-dot" />
          </button>
          <button
            className={`nav-item ${dialog === "rooms" ? "active" : ""}`}
            onClick={openRooms}
          >
            <Icon name="rooms" />
            <span className="nav-text">Phòng chơi</span><span className="count-badge">{rooms.length}</span>
          </button>
          <button className={`nav-item ${dialog === "onlinePlayers" ? "active" : ""}`} onClick={() => setDialog("onlinePlayers")}><Icon name="users" /><span className="nav-text">Kỳ thủ online</span><span className="count-badge">{onlineUsers.length}</span></button>
          <button
            className={`nav-item ${dialog === "history" ? "active" : ""}`}
            onClick={() => setDialog("history")}
          >
            <Icon name="history" />
            <span className="nav-text">Lịch sử</span>
          </button>
          <button className={`nav-item ${dialog === "leaderboard" ? "active" : ""}`} onClick={() => setDialog("leaderboard")}>
            <Icon name="trophy" /> <span className="nav-text">Xếp hạng</span>
          </button>
          <button
            className={`nav-item ${dialog === "rules" ? "active" : ""}`}
            onClick={() => setDialog("rules")}
          >
            <Icon name="book" />
            <span className="nav-text">Cách chơi</span>
          </button>
        </nav>
        <div className="sidebar-bottom" style={{ cursor: "pointer" }} onClick={() => { setRenameInput(name); setDialog("rename"); }} title="Bấm để đổi tên hiển thị">
          <div className="avatar">{(account?.name || name || "B").charAt(0).toUpperCase()}</div>
          <div>
            <strong>{account?.name || name || "Người chơi mới"} <Icon name="edit" size={12} /></strong>
            <span>{account ? `@${account.username}` : "Đang chơi với tư cách khách"}</span>
          </div>
          <span className="green-dot" />
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Không gian chơi</span> <Icon name="chevron" size={14} />
            <strong>Bàn cờ Caro</strong>
          </div>
          <div
            className={`connection ${connection === "online" ? "" : "disconnected"}`}
          >
            <span className="green-dot" />
            <span className="connection-label">{connection === "online"
              ? "Server đang kết nối"
              : connection === "replaced"
                ? "Phiên đã mở ở nơi khác"
                : connection === "offline"
                  ? "Đang kết nối lại…"
                  : "Đang kết nối…"}</span>
          </div>
          <button className="account-button" onClick={() => { setAuthError(""); setDialog("auth"); }}>
            <span className="account-button-avatar">{account ? account.name.charAt(0).toUpperCase() : <Icon name="shield" size={16} />}</span>
            <span>{account ? account.username : "Đăng nhập"}</span>
          </button>
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
              <p>Một không gian chiến thuật để chơi, xem và kết nối cùng bạn bè.</p>
            </div>
            {playMode === "online" && playerReady && (
              <button
                className="button secondary room-browse"
                onClick={() => setDialog("rooms")}
              >
                <Icon name="rooms" size={18} />
                Khám phá phòng
                <Icon name="arrow" size={17} />
              </button>
            )}
          </section>

        <section className="mode-picker" aria-label="Chọn chế độ chơi">
          <div className="mode-options">
            <button type="button" className={`mode-option ${playMode === "practice" ? "selected" : ""}`} aria-pressed={playMode === "practice"} onClick={choosePractice}>
              <Icon name="bot" size={20} /><span>Đấu với máy<small>Luyện tập cùng Caro Bot</small></span>
            </button>
            <button type="button" className={`mode-option ${playMode === "online" ? "selected" : ""}`} aria-pressed={playMode === "online"} onClick={chooseOnline}>
              <Icon name="link" size={20} /><span>Đấu online<small>Tạo phòng, mời bạn bằng QR</small></span>
            </button>
          </div>
          <p>{playMode === "practice"
            ? "Bạn cầm X và đi trước. Bấm vào ô trống để đánh, Caro Bot sẽ tự đáp lại."
            : isSpectator
              ? `Bạn đang xem trực tiếp phòng #${room.id} cùng ${room.spectators || 0} khán giả.`
              : isOnline
                ? "Bạn đang ở phòng online. Chọn Đấu với máy để chuyển sang luyện tập."
                : "Tạo phòng riêng, ghép trận hoặc nhập mã phòng để chơi cùng bạn bè."}</p>
        </section>
        {playMode === "online" && playerReady && !isOnline && invitedRoom && (
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
          <div className={`game-layout ${playMode === "practice" ? "practice-layout" : !isOnline ? "online-setup-layout" : "online-layout"}`}>
            {!accountChecked ? (
              <section className="online-gate-card" aria-live="polite">
                <span className="online-gate-icon"><Icon name={playMode === "practice" ? "bot" : "link"} size={28} /></span>
                <h2>Đang chuẩn bị bàn chơi…</h2>
                <p>Chỉ một chút nữa thôi.</p>
              </section>
            ) : !playerReady ? (
              <section className="online-gate-card">
                <span className="online-gate-kicker">BƯỚC ĐẦU TIÊN</span>
                <span className="online-gate-icon"><Icon name={playMode === "practice" ? "bot" : "link"} size={28} /></span>
                <h2>Đặt tên trước khi bắt đầu</h2>
                <p>Tên này sẽ hiển thị trên bàn cờ và với đối thủ khi bạn chơi online. Bạn không cần tạo tài khoản.</p>
                <form className="online-name-form" onSubmit={confirmGuestName}>
                  <label htmlFor="online-guest-name">Tên của bạn</label>
                  <div>
                    <input
                      id="online-guest-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      maxLength={24}
                      placeholder="Bạn muốn được gọi là gì?"
                      autoComplete="nickname"
                      autoFocus
                    />
                    <button className="button primary" type="submit" disabled={!name.trim()}>
                      {playMode === "practice" ? "Bắt đầu đấu với máy" : "Vào sảnh online"} <Icon name="arrow" size={17} />
                    </button>
                  </div>
                </form>
                <button className="online-login-link" type="button" onClick={() => { setAuthError(""); setDialog("auth"); }}>
                  Đã có tài khoản? Đăng nhập
                </button>
              </section>
            ) : playMode === "practice" || isOnline ? <GameCard
              room={room}
              isOnline={isOnline}
              isSpectator={isSpectator}
              me={me}
              displayName={name}
              paused={paused}
              myTurn={myTurn}
              canMove={canMove}
              remaining={remaining}
              mySymbol={mySymbol}
              resultText={resultText}
              reasonText={reasonText[room.reason || "five"]}
              sound={sound}
              onMove={move}
              onBoardKeyDown={boardKeyboard}
              onPlayAgain={() => isOnline ? send({ type: "rematch" }) : newPractice()}
              onDeclineRematch={() => send({ type: "rematchDecline" })}
              onReplay={() => openReplay({ id: room.round, players: room.players, moves: room.moves, reason: room.reason })}
              onUndo={undo}
              onToggleSound={() => setSound(!sound)}
              onResign={() => setDialog("resign")}
              onDrawOffer={() => { send({ type: "drawOffer" }); notify("Đã gửi đề nghị hòa đến đối thủ."); }}
            /> : (
              <section className="online-entry-grid" aria-label="Chọn cách đấu online">
                <article className="online-setup-card room-setup-card">
                  <span className="setup-card-icon"><Icon name="rooms" size={25} /></span>
                  <span className="online-gate-kicker">PHÒNG CHƠI RIÊNG</span>
                  <h2>Tạo hoặc tìm phòng</h2>
                  <p>Tạo phòng để mời bạn bè, xem danh sách phòng đang mở hoặc tham gia nhanh bằng mã.</p>
                  <button
                    className="button primary full setup-primary-action"
                    disabled={connection !== "online" || matching}
                    onClick={() => enterRoom()}
                  >
                    <Icon name="plus" size={18} />
                    Tạo phòng mới
                    <Icon name="arrow" size={17} />
                  </button>
                  <button className="button secondary full" type="button" onClick={() => setDialog("rooms")}>
                    <Icon name="rooms" size={17} />
                    Xem phòng đang mở{rooms.length ? ` · ${rooms.length}` : ""}
                  </button>
                  <div className="setup-divider"><span />hoặc nhập mã phòng<span /></div>
                  <form
                    className="setup-join-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      enterRoom(code);
                    }}
                  >
                    <input
                      aria-label="Mã phòng"
                      placeholder="Ví dụ: A1B2C3"
                      value={code}
                      onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-F0-9]/g, "").slice(0, 6))}
                      maxLength={6}
                    />
                    <button type="submit" className="button primary" disabled={connection !== "online" || matching || code.length !== 6}>
                      Vào phòng <Icon name="arrow" size={17} />
                    </button>
                  </form>
                </article>

                <article className="online-setup-card matchmaking-setup-card">
                  <span className="setup-card-icon"><Icon name="shuffle" size={25} /></span>
                  <span className="online-gate-kicker">GHÉP ĐẤU NHANH</span>
                  <h2>{matching ? "Đang tìm đối thủ…" : "Tìm đối thủ phù hợp"}</h2>
                  <p>{matching
                    ? "Bạn đang ở trong hàng chờ. Có thể hủy bất cứ lúc nào nếu muốn chọn cách chơi khác."
                    : "Vào hàng chờ và để server tự động kết nối bạn với một người chơi khác đang sẵn sàng."}</p>
                  <div className="matchmaking-stats">
                    <span><strong>{onlineCount}</strong> đang kết nối</span>
                    <span><strong>{matchingCount}</strong> đang chờ ghép</span>
                  </div>
                  <button
                    className={`button full setup-match-button ${matching ? "secondary" : "primary"}`}
                    disabled={connection !== "online"}
                    onClick={findMatch}
                  >
                    <Icon name="shuffle" size={18} />
                    {matching ? "Hủy tìm đối thủ" : "Bắt đầu ghép đấu"}
                  </button>
                  <small>Hệ thống ghép tự động · Không cần mã phòng</small>
                </article>
              </section>
            )}

            {playMode === "online" && playerReady && isOnline && <aside className="right-column">
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
                {!isSpectator && <InvitePanel roomId={room.id} notify={notify} />}
                {isSpectator && <div className="spectator-card"><Icon name="eye" size={23} /><strong>Chế độ khán giả</strong><span>Bạn đang theo dõi ván cờ trực tiếp. Nước đi và chat chỉ dành cho hai người chơi.</span></div>}
                <button
                  className="leave-button"
                  onClick={() => setDialog("leave")}
                >
                  <Icon name="exit" size={15} />
                  Rời phòng
                </button>
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
                    disabled={!isOnline || isSpectator || connection !== "online"}
                  />
                  <button
                    aria-label="Gửi tin nhắn"
                    type="submit"
                    disabled={
                      !isOnline || isSpectator || !chat.trim() || connection !== "online"
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
            </aside>}
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
                {(myScore?.wins ?? 0) + wins}
                <small>Ván thắng</small>
              </strong>
              <span className="stat-divider" />
              <strong>
                {(myScore?.played ?? 0) + localGames.length}
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

            {invitation && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 420 }}>
            <div className="modal-header"><h2>Lời mời thách đấu</h2></div>
            <p style={{ margin: "16px 0", fontSize: 16 }}>
              Kỳ thủ <strong>{invitation.fromName}</strong> muốn thách đấu một ván Caro cùng bạn!
            </p>
            <div className="modal-actions" style={{ display: "flex", gap: 12 }}>
              <button type="button" className="button secondary" style={{ flex: 1 }} onClick={() => { send({ type: "inviteResponse", invitationId: invitation.id, accept: false }); setInvitation(null); }}>Từ chối</button>
              <button type="button" className="button primary" style={{ flex: 1 }} onClick={() => { send({ type: "inviteResponse", invitationId: invitation.id, accept: true }); setInvitation(null); }}>Chấp nhận</button>
            </div>
          </div>
        </div>
      )}
      {drawOfferFrom && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 420 }}>
            <div className="modal-header"><h2>Đề nghị hòa cờ</h2></div>
            <p style={{ margin: "16px 0", fontSize: 16 }}>
              Đối thủ <strong>{drawOfferFrom}</strong> đề nghị hòa ván cờ này. Bạn có đồng ý không?
            </p>
            <div className="modal-actions" style={{ display: "flex", gap: 12 }}>
              <button type="button" className="button secondary" style={{ flex: 1 }} onClick={() => { send({ type: "drawResponse", accept: false }); setDrawOfferFrom(null); }}>Tiếp tục đánh</button>
              <button type="button" className="button primary" style={{ flex: 1 }} onClick={() => { send({ type: "drawResponse", accept: true }); setDrawOfferFrom(null); }}>Đồng ý hòa</button>
            </div>
          </div>
        </div>
      )}
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
                {dialog === "auth"
                  ? account ? "Tài khoản của bạn" : "Lưu thành tích của bạn"
                  : dialog === "rooms"
                  ? "Tìm bạn cùng chơi"
                  : dialog === "history"
                    ? "Những ván cờ đã qua"
                  : dialog === "leaderboard"
                    ? "Bảng xếp hạng"
                  : dialog === "replay"
                    ? "Xem lại ván đấu"
                    : dialog === "onlinePlayers" ? "Kỳ thủ trực tuyến" : dialog === "rename" ? "Đổi tên hiển thị" : dialog === "rules"
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
            {dialog === "auth" && (account ? (
              <div className="auth-profile">
                <div className="auth-profile-avatar">{account.name.charAt(0).toUpperCase()}</div>
                <strong>{account.name}</strong>
                <span>@{account.username}</span>
                <p>Lịch sử và bảng xếp hạng online của tài khoản được lưu trong MongoDB. Bạn có thể đăng nhập lại trên thiết bị khác.</p>
                <button type="button" className="button secondary full" style={{ marginBottom: 8 }} onClick={() => { setRenameInput(name); setDialog("rename"); }}><Icon name="edit" size={14} /> Đổi tên hiển thị</button>
                {authError && <p className="auth-error" role="alert">{authError}</p>}
                <button className="button secondary full" onClick={logout} disabled={authBusy || (isOnline && room.status === "playing")}>Đăng xuất</button>
                {isOnline && room.status === "playing" && <small>Hãy kết thúc hoặc rời ván hiện tại để đăng xuất.</small>}
              </div>
            ) : (
              <>
                <p className="modal-description">Đăng nhập để lưu lịch sử đấu online theo tài khoản và tiếp tục trên thiết bị khác.</p>
                <div className="auth-tabs" role="group" aria-label="Chọn cách vào tài khoản">
                  <button className={authMode === "login" ? "active" : ""} onClick={() => { setAuthMode("login"); setAuthError(""); }} type="button">Đăng nhập</button>
                  <button className={authMode === "register" ? "active" : ""} onClick={() => { setAuthMode("register"); setAuthError(""); }} type="button">Tạo tài khoản</button>
                </div>
                <form className="auth-form" onSubmit={submitAuth}>
                  <label htmlFor="auth-username">Tên tài khoản</label>
                  <input id="auth-username" value={authUsername} onChange={(event) => setAuthUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" placeholder="Ví dụ: caro_player" required />
                  <small>3–24 ký tự: chữ, số hoặc dấu gạch dưới.</small>
                  <label htmlFor="auth-password">Mật khẩu</label>
                  <input id="auth-password" type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} autoComplete={authMode === "register" ? "new-password" : "current-password"} minLength={authMode === "register" ? 8 : undefined} placeholder="Nhập mật khẩu" required />
                  {authMode === "register" && <small>Ít nhất 8 ký tự. Thành tích chơi khách trước đây vẫn ở hồ sơ khách.</small>}
                  {authError && <p className="auth-error" role="alert">{authError}</p>}
                  <button className="button primary full" type="submit" disabled={authBusy || isOnline}>{authBusy ? "Đang xử lý…" : authMode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</button>
                  {isOnline && <small>Rời phòng hiện tại để đổi tài khoản.</small>}
                </form>
              </>
            ))}
                        {dialog === "rename" && (
              <form onSubmit={(event) => {
                event.preventDefault();
                const trimmed = renameInput.trim();
                if (!trimmed) return;
                send({ type: "rename", name: trimmed });
                setName(trimmed);
                try { localStorage.setItem("caro-name", trimmed); } catch {}
                notify("Đã đổi tên thành công: " + trimmed);
                setDialog(null);
              }}>
                <p className="modal-description">Tên mới sẽ hiển thị cho các kỳ thủ khác và trên bảng xếp hạng.</p>
                <div style={{ margin: "16px 0" }}>
                  <input className="name-input" style={{ width: "100%", boxSizing: "border-box" }} placeholder="Nhập tên hiển thị mới" maxLength={24} value={renameInput} onChange={(event) => setRenameInput(event.target.value)} autoFocus />
                </div>
                <div className="modal-actions" style={{ display: "flex", gap: 12 }}>
                  <button type="button" className="button secondary" style={{ flex: 1 }} onClick={() => setDialog(null)}>Hủy</button>
                  <button type="submit" className="button primary" style={{ flex: 1 }}>Lưu tên</button>
                </div>
              </form>
            )}
            {dialog === "onlinePlayers" && (
              <OnlinePanel
                users={onlineUsers}
                myUserId={userId}
                isOnline={isOnline}
                matching={matching}
                onInvite={(targetId, targetName) => {
                  send({ type: "invite", targetUserId: targetId, name });
                  notify("Đã gửi lời mời thách đấu tới " + targetName + "!");
                }}
              />
            )}
            {dialog === "rooms" && (
              <>
                <p className="modal-description">
                  Chọn phòng để tham gia hoặc theo dõi trực tiếp.
                </p>
                <button className={`button full ${matching ? "secondary" : "primary"}`} disabled={isOnline || connection !== "online"} onClick={findMatch}>{matching ? "Hủy tìm trận" : `Tìm đối thủ tự động${matchingCount ? ` · ${matchingCount} đang chờ` : ""}`}</button>
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
                            #{item.id} · {item.count}/2 người chơi · {item.spectators || 0} đang xem
                          </small>
                        </div>
                        <div className="room-row-actions">
                          {item.status === "waiting" && <button className="button primary" disabled={isOnline || matching || connection !== "online"} onClick={() => enterRoom(item.id)}>Tham gia</button>}
                          <button className="button secondary" disabled={isOnline || matching || connection !== "online"} onClick={() => { if (send({ type: "spectate", roomId: item.id })) setDialog(null); }}><Icon name="eye" size={16} /> Xem</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="modal-empty">
                    <Icon name="rooms" size={36} />
                    <h3>Chưa có phòng đang hoạt động.</h3>
                    <p>Hãy tạo phòng hoặc tìm đối thủ tự động!</p>
                  </div>
                )}
                <button
                  className="button primary full"
                  disabled={isOnline || matching || connection !== "online"}
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
                  Ván online lưu trên server; ván đấu máy lưu trên trình duyệt.
                </p>
                {serverHistory.length || history.some((item) => item.mode !== "Online") ? (
                  <div className="history-list">
                    {serverHistory.map((match) => {
                      const opponent = match.players.find((p) => p.id !== profileId);
                      const result = !match.winner ? "Hòa" : match.winner === profileId ? "Thắng" : "Thua";
                      return <div className="history-row" key={match.id}>
                        <span className={`result-badge ${result === "Thắng" ? "win" : result === "Thua" ? "loss" : ""}`}>{result}</span>
                        <div><strong>vs. {opponent?.name || "Đối thủ"}</strong><small>Online · {match.moves.length} nước đi</small></div>
                        <time>{new Date(match.at).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>
                        <button className="button secondary" onClick={() => openReplay(match)}>Xem lại</button>
                      </div>;
                    })}
                    {history.filter((item) => item.mode !== "Online").map((item) => (
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
                        {item.sequence && <button className="button secondary" onClick={() => openReplay({ id: item.id, players: item.players || [{ name: "Bạn" }, { name: "Caro Bot" }], moves: item.sequence!, reason: null })}>Xem lại</button>}
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
            {dialog === "leaderboard" && <>
              <p className="modal-description">Thành tích các ván online đã hoàn tất, lưu trên server. Tên hiển thị do người chơi tự chọn.</p>
              {leaderboard.length ? <div className="leaderboard-list">{leaderboard.map((score, index) => <div className="leaderboard-row" key={score.id}><span className="leaderboard-rank">{String(index + 1).padStart(2, "0")}</span><strong>{score.name}{score.id === profileId ? " · Bạn" : ""}</strong><span>{score.wins} thắng</span><small>{score.played} ván · {score.draws} hòa</small></div>)}</div> : <div className="modal-empty"><Icon name="trophy" size={36} /><h3>Chưa có kết quả online.</h3><p>Hoàn thành một trận để xuất hiện trên bảng xếp hạng.</p></div>}
            </>}
            {dialog === "replay" && replaySource && <ReplayPanel replay={replaySource} />}
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
                    Phòng và chat lưu trong RAM. Tài khoản, lịch sử online và bảng xếp hạng lưu trong MongoDB. Bạn cũng có thể chơi với tư cách khách.
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
                    : room.status === "playing" && !isSpectator
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
