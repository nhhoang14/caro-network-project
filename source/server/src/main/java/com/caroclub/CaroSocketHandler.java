package com.caroclub;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.PingMessage;
import org.springframework.web.socket.PongMessage;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class CaroSocketHandler extends TextWebSocketHandler {
    private static final Logger log = LoggerFactory.getLogger(CaroSocketHandler.class);
    private static final CloseStatus POLICY = new CloseStatus(1008, "Hello required");
    private final RoomService service;
    private final AuthService auth;
    private final ObjectMapper json;
    private final Map<String, Client> clients = new ConcurrentHashMap<>();

    private static final class Client {
        ConcurrentWebSocketSessionDecorator socket;
        RoomService.Connected connected;
        String authToken;
        long connectedAt = System.currentTimeMillis(), windowStart = connectedAt;
        int count;
        boolean alive = true;
    }

    public CaroSocketHandler(RoomService service, ObjectMapper json, AuthService auth) {
        this.service = service; this.json = json; this.auth = auth;
    }

    @Override public void afterConnectionEstablished(WebSocketSession session) {
        Client client = new Client();
        client.socket = new ConcurrentWebSocketSessionDecorator(session, 10_000, 262_144);
        client.authToken = AuthService.cookieToken(session.getHandshakeHeaders().getFirst("Cookie"));
        clients.put(session.getId(), client);
    }
    private void send(Client client, Object payload) {
        try {
            if (client.socket.isOpen()) client.socket.sendMessage(new TextMessage(json.writeValueAsString(payload)));
        } catch (IOException e) { close(client, CloseStatus.SERVER_ERROR); }
    }
    private void close(Client client, CloseStatus status) {
        try { if (client.socket.isOpen()) client.socket.close(status); }
        catch (IOException ignored) {}
    }
    @Override protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        Client client = clients.get(session.getId());
        if (client == null) return;
        long now = System.currentTimeMillis();
        if (now - client.windowStart > 1000) { client.windowStart = now; client.count = 0; }
        if (++client.count > 30) { close(client, new CloseStatus(1008, "Rate limit")); return; }
        try {
            JsonNode data = json.readTree(message.getPayload());
            if (client.connected == null) {
                if (!"hello".equals(data.path("type").asText())) { close(client, POLICY); return; }
                String token = data.path("token").isTextual() ? data.path("token").asText() : null;
                String profileToken = data.path("profileToken").isTextual() ? data.path("profileToken").asText() : null;
                AuthService.AccountView account = auth.fromToken(client.authToken);
                if (account == null) client.authToken = null;
                client.connected = service.connect(token, payload -> send(client, payload),
                        () -> close(client, new CloseStatus(4001, "Session opened elsewhere")), profileToken,
                        account == null ? null : account.profileId());
            } else {
                if (client.authToken != null && auth.fromToken(client.authToken) == null) {
                    close(client, new CloseStatus(4003, "Session expired")); return;
                }
                String type = data.path("type").asText("");
                if (("create".equals(type) || "join".equals(type) || "match".equals(type) || "invite".equals(type)) && client.authToken == null) {
                    send(client, Map.of("type", "error", "message", "Bạn cần đăng nhập tài khoản để tham gia đấu online."));
                    return;
                }
                service.handle(client.connected.user(), data);
            }
        } catch (Exception e) {
            log.warn("WebSocket request failed", e);
            send(client, Map.of("type", "error", "message", "Không thể xử lý yêu cầu."));
        }
    }
    @Override protected void handlePongMessage(WebSocketSession session, PongMessage message) {
        Client client = clients.get(session.getId());
        if (client != null) client.alive = true;
    }
    @Override public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Client client = clients.remove(session.getId());
        if (client != null && client.connected != null) service.disconnect(client.connected.user(), client.connected.connectionId());
    }
    @Override public void handleTransportError(WebSocketSession session, Throwable error) {
        Client client = clients.get(session.getId());
        if (client != null) close(client, CloseStatus.SERVER_ERROR);
    }
    @Scheduled(fixedDelay = 15_000)
    public void heartbeat() {
        for (Client client : clients.values()) {
            if (client.authToken != null && auth.fromToken(client.authToken) == null) {
                close(client, new CloseStatus(4003, "Session expired")); continue;
            }
            if (!client.alive) { close(client, CloseStatus.SESSION_NOT_RELIABLE); continue; }
            client.alive = false;
            try { if (client.socket.isOpen()) client.socket.sendMessage(new PingMessage()); }
            catch (IOException e) { close(client, CloseStatus.SERVER_ERROR); }
        }
    }
    public void closeForSession(String token) {
        if (token == null) return;
        for (Client client : clients.values())
            if (token.equals(client.authToken)) close(client, new CloseStatus(4003, "Logged out"));
    }
    @Scheduled(fixedDelay = 1000)
    public void requireHello() {
        long now = System.currentTimeMillis();
        for (Client client : clients.values())
            if (client.connected == null && now - client.connectedAt > 5000) close(client, POLICY);
    }
}
