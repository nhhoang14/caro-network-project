package com.caroclub;

import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;
import java.util.Map;

@Configuration
@EnableWebSocket
public class SocketConfig implements WebSocketConfigurer {
    private final CaroSocketHandler handler;
    private final String publicUrl;
    public SocketConfig(CaroSocketHandler handler, @Value("${caro.public-url:}") String publicUrl) {
        this.handler = handler;
        this.publicUrl = publicUrl;
    }
    @Override public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/ws").addInterceptors(new HandshakeInterceptor() {
            @Override public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                    org.springframework.web.socket.WebSocketHandler wsHandler, Map<String, Object> attributes) {
                String origin = request.getHeaders().getFirst(HttpHeaders.ORIGIN);
                if (origin == null) return true;
                try {
                    URI url = URI.create(origin);
                    String scheme = url.getScheme();
                    if (!("http".equals(scheme) || "https".equals(scheme)) || url.getRawUserInfo() != null
                            || url.getPath() != null && !url.getPath().isEmpty()) return false;
                    String host = request.getHeaders().getFirst(HttpHeaders.HOST);
                    return url.getAuthority().equalsIgnoreCase(host) || origin.equals(publicUrl);
                } catch (IllegalArgumentException e) { return false; }
            }
            @Override public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                    org.springframework.web.socket.WebSocketHandler wsHandler, Exception exception) {}
        }).setAllowedOriginPatterns("*");
    }
    @Bean public ServletServerContainerFactoryBean webSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize(8192);
        container.setMaxBinaryMessageBufferSize(8192);
        return container;
    }
}
