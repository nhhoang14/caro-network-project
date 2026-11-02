import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClientCommand,
  ConnectionStatus,
  LobbyRoom,
  Room,
  Score,
  ServerEvent,
  ServerMatch,
} from "../types";

export function useCaroSocket(onError: (message: string) => void) {
  const [onlineRoom, setOnlineRoom] = useState<Room | null>(null);
  const [userId, setUserId] = useState("");
  const [connection, setConnection] = useState<ConnectionStatus>("connecting");
  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [matchingCount, setMatchingCount] = useState(0);
  const [matching, setMatching] = useState(false);
  const [serverHistory, setServerHistory] = useState<ServerMatch[]>([]);
  const [leaderboard, setLeaderboard] = useState<Score[]>([]);
  const [profileId, setProfileId] = useState("");
  const [clockOffset, setClockOffset] = useState(0);
  const socket = useRef<WebSocket | null>(null);
  const errorHandler = useRef(onError);

  useEffect(() => {
    errorHandler.current = onError;
  }, [onError]);

  const send = useCallback((command: ClientCommand) => {
    if (socket.current?.readyState !== WebSocket.OPEN) {
      errorHandler.current("Đang mất kết nối server. Bạn vẫn có thể đấu với máy.");
      return false;
    }
    socket.current.send(JSON.stringify(command));
    return true;
  }, []);

  const reconnect = useCallback(() => socket.current?.close(), []);

  const resetServerData = useCallback((clearProfile = false) => {
    setServerHistory([]);
    setLeaderboard([]);
    if (clearProfile) setProfileId("");
  }, []);

  useEffect(() => {
    let disposed = false;
    let retry: ReturnType<typeof setTimeout>;

    function connect() {
      if (disposed) return;
      setConnection("connecting");
      const ws = new WebSocket(
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`,
      );
      socket.current = ws;
      ws.onopen = () => {
        let token = null;
        let profileToken = null;
        try {
          token = sessionStorage.getItem("caro-session");
          profileToken = sessionStorage.getItem("caro-profile");
        } catch {
          // Storage can be unavailable in hardened browsers.
        }
        ws.send(JSON.stringify({ type: "hello", token, profileToken }));
      };
      ws.onmessage = (event) => {
        if (disposed) return;
        const data = JSON.parse(event.data) as ServerEvent;
        if (data.type === "welcome") {
          try {
            sessionStorage.setItem("caro-session", data.token);
            if (data.profileToken) sessionStorage.setItem("caro-profile", data.profileToken);
          } catch {
            // Storage can be unavailable in hardened browsers.
          }
          setUserId(data.id);
          setProfileId(data.profileId || "");
          setConnection("online");
          setClockOffset(data.serverTime - Date.now());
          setOnlineRoom(null);
        } else if (data.type === "lobby") {
          setRooms(data.rooms);
          setOnlineCount(data.online);
          setMatchingCount(data.matching || 0);
        } else if (data.type === "room") setOnlineRoom(data.room);
        else if (data.type === "left") setOnlineRoom(null);
        else if (data.type === "matchmaking") setMatching(Boolean(data.waiting));
        else if (data.type === "stats") {
          setServerHistory(data.history || []);
          setLeaderboard(data.leaderboard || []);
        } else if (data.type === "error") errorHandler.current(data.message);
      };
      ws.onclose = (event) => {
        if (disposed) return;
        if (event.code === 4001) {
          setConnection("replaced");
          return;
        }
        setConnection("offline");
        setMatching(false);
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

  return {
    onlineRoom,
    userId,
    connection,
    rooms,
    onlineCount,
    matchingCount,
    matching,
    serverHistory,
    leaderboard,
    profileId,
    clockOffset,
    send,
    reconnect,
    resetServerData,
  };
}
