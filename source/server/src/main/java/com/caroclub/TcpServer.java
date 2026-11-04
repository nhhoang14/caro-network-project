package com.caroclub;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.EOFException;
import java.io.IOException;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Native TCP Socket Server (Tầng Transport) cho học phần Lập trình mạng.
 * Lắng nghe tại cổng 3001, sử dụng kỹ thuật Framing 4-byte Big-Endian Integer độ dài + JSON UTF-8.
 */
@Component
public class TcpServer {
    private static final Logger log = LoggerFactory.getLogger(TcpServer.class);
    private final int port;
    private final RoomService roomService;
    private final ObjectMapper json;
    private final ExecutorService threadPool = Executors.newCachedThreadPool();
    private ServerSocket serverSocket;
    private volatile boolean running = true;

    public TcpServer(@Value("${tcp.port:3001}") int port, RoomService roomService, ObjectMapper json) {
        this.port = port;
        this.roomService = roomService;
        this.json = json;
    }

    @PostConstruct
    public void start() {
        threadPool.submit(() -> {
            try {
                serverSocket = new ServerSocket(port);
                log.info("TCP Socket Server đã khởi động thành công trên cổng {}", port);
                while (running) {
                    try {
                        Socket clientSocket = serverSocket.accept();
                        threadPool.submit(new ClientHandler(clientSocket));
                    } catch (SocketException se) {
                        if (!running) break;
                        log.warn("Lỗi accept TCP client: {}", se.getMessage());
                    }
                }
            } catch (IOException e) {
                log.error("Không thể mở TCP ServerSocket trên cổng {}: {}", port, e.getMessage());
            }
        });
    }

    @PreDestroy
    public void stop() {
        running = false;
        try {
            if (serverSocket != null && !serverSocket.isClosed()) serverSocket.close();
        } catch (IOException ignored) {}
        threadPool.shutdownNow();
    }

    private final class ClientHandler implements Runnable {
        private final Socket socket;
        private RoomService.Connected connected;

        ClientHandler(Socket socket) {
            this.socket = socket;
        }

        @Override
        public void run() {
            try (socket;
                 DataInputStream in = new DataInputStream(socket.getInputStream());
                 DataOutputStream out = new DataOutputStream(socket.getOutputStream())) {

                while (running && !socket.isClosed()) {
                    int length;
                    try {
                        length = in.readInt();
                    } catch (EOFException | SocketException e) {
                        break;
                    }
                    if (length <= 0 || length > 1_000_000) {
                        log.warn("Độ dài frame TCP không hợp lệ: {}", length);
                        break;
                    }
                    byte[] payload = new byte[length];
                    in.readFully(payload);
                    String text = new String(payload, StandardCharsets.UTF_8);
                    JsonNode data = json.readTree(text);

                    if (connected == null) {
                        String type = data.path("type").asText("");
                        if (!"hello".equals(type) && !"ping".equals(type)) {
                            sendFrame(out, json.createObjectNode().put("type", "error").put("message", "Cần gửi lệnh hello trước."));
                            continue;
                        }
                        if ("ping".equals(type)) {
                            sendFrame(out, json.createObjectNode().put("type", "pong"));
                            continue;
                        }
                        String token = data.path("token").isTextual() ? data.path("token").asText() : null;
                        String profileToken = data.path("profileToken").isTextual() ? data.path("profileToken").asText() : null;

                        connected = roomService.connect(token, obj -> {
                            try {
                                sendFrame(out, obj);
                            } catch (Exception e) {
                                try { socket.close(); } catch (IOException ignored) {}
                            }
                        }, () -> {
                            try { socket.close(); } catch (IOException ignored) {}
                        }, profileToken);
                    } else {
                        String type = data.path("type").asText("");
                        if ("ping".equals(type)) {
                            sendFrame(out, json.createObjectNode().put("type", "pong"));
                            continue;
                        }
                        roomService.handle(connected.user(), data);
                    }
                }
            } catch (Exception e) {
                // Connection closed or error
            } finally {
                if (connected != null) {
                    roomService.disconnect(connected.user(), connected.connectionId());
                }
            }
        }

        private void sendFrame(DataOutputStream out, Object obj) throws IOException {
            byte[] bytes = json.writeValueAsBytes(obj);
            synchronized (out) {
                out.writeInt(bytes.length);
                out.write(bytes);
                out.flush();
            }
        }
    }
}

