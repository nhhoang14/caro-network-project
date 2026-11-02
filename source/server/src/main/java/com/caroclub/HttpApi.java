package com.caroclub;

import java.net.Inet4Address;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Enumeration;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HttpApi {
    private final RoomService service;
    private final int port;
    private final String publicUrl;
    public HttpApi(RoomService service, @Value("${server.port:3000}") int port,
            @Value("${caro.public-url:}") String publicUrl) {
        this.service = service; this.port = port; this.publicUrl = publicUrl;
    }
    @GetMapping("/health") public Map<String, Object> health() {
        return Map.of("status", "ok", "rooms", service.roomCount(), "transport", "WebSocket");
    }
    @GetMapping("/api/connection") public Map<String, Object> connection() throws SocketException {
        List<Map<String, String>> origins = new ArrayList<>();
        if (!publicUrl.isBlank()) origins.add(Map.of("url", publicUrl, "label", "Internet", "kind", "public"));
        List<NetworkInterface> interfaces = new ArrayList<>();
        Enumeration<NetworkInterface> all = NetworkInterface.getNetworkInterfaces();
        while (all.hasMoreElements()) interfaces.add(all.nextElement());
        interfaces.sort(Comparator.comparingInt(i -> i.getName().matches("(?i).*wi-?fi.*|.*wlan.*|.*wireless.*") ? 0 : 1));
        for (NetworkInterface net : interfaces) {
            Enumeration<java.net.InetAddress> addresses = net.getInetAddresses();
            while (addresses.hasMoreElements()) {
                java.net.InetAddress address = addresses.nextElement();
                if (!(address instanceof Inet4Address) || address.isLoopbackAddress()) continue;
                byte[] bytes = address.getAddress();
                int a = bytes[0] & 255, b = bytes[1] & 255;
                if (!(a == 10 || a == 172 && b >= 16 && b <= 31 || a == 192 && b == 168)) continue;
                String url = "http://" + address.getHostAddress() + ":" + port;
                if (origins.stream().noneMatch(o -> o.get("url").equals(url)))
                    origins.add(Map.of("url", url, "label", net.getDisplayName(), "kind", "lan"));
            }
        }
        return Map.of("origins", origins);
    }
}
