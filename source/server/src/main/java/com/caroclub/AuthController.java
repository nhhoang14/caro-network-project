package com.caroclub;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    private final CaroSocketHandler sockets;
    private final String publicUrl;
    public AuthController(AuthService auth, CaroSocketHandler sockets, @Value("${caro.public-url:}") String publicUrl) {
        this.auth = auth;
        this.sockets = sockets;
        this.publicUrl = ConnectionPolicy.normalizePublicUrl(publicUrl);
    }
    public record Credentials(String username, String password) {}
    public record AuthState(AuthService.AccountView account) {}

    private void checkRequest(HttpServletRequest request, String requestedBy) {
        if (!"1".equals(requestedBy)) throw new AuthService.AuthError(403, "Yêu cầu không hợp lệ.");
        String origin = request.getHeader(HttpHeaders.ORIGIN);
        if (origin == null) return;
        String host = request.getHeader(HttpHeaders.HOST);
        String normalized;
        try { normalized = ConnectionPolicy.normalizePublicUrl(origin); }
        catch (IllegalArgumentException error) { normalized = ""; }
        if (normalized.isBlank()
                || !(normalized.equals(request.getScheme() + "://" + host)
                        || !publicUrl.isBlank() && normalized.equals(publicUrl)))
            throw new AuthService.AuthError(403, "Nguồn yêu cầu không được phép.");
    }
    private ResponseCookie cookie(String token, HttpServletRequest request) {
        return ResponseCookie.from(AuthService.COOKIE, token)
                .httpOnly(true).secure(request.isSecure() || publicUrl.startsWith("https://"))
                .sameSite("Lax").path("/")
                .maxAge(token.isEmpty() ? Duration.ZERO : AuthService.SESSION_LIFETIME).build();
    }
    @GetMapping("/me") public ResponseEntity<AuthState> me(@CookieValue(name = AuthService.COOKIE, required = false) String token) {
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "no-store").body(new AuthState(auth.fromToken(token)));
    }
    @PostMapping(value = "/register", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<AuthState> register(@RequestBody Credentials credentials, HttpServletRequest request,
            @RequestHeader(value = "X-Caro-Request", required = false) String requestedBy,
            @CookieValue(name = AuthService.COOKIE, required = false) String previousToken) {
        checkRequest(request, requestedBy);
        AuthService.LoginResult result = auth.register(credentials.username(), credentials.password());
        auth.logout(previousToken);
        sockets.closeForSession(previousToken);
        return ResponseEntity.status(HttpStatus.CREATED).header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header(HttpHeaders.SET_COOKIE, cookie(result.token(), request).toString())
                .body(new AuthState(result.account()));
    }
    @PostMapping(value = "/login", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<AuthState> login(@RequestBody Credentials credentials, HttpServletRequest request,
            @RequestHeader(value = "X-Caro-Request", required = false) String requestedBy,
            @CookieValue(name = AuthService.COOKIE, required = false) String previousToken) {
        checkRequest(request, requestedBy);
        AuthService.LoginResult result = auth.login(credentials.username(), credentials.password(), request.getRemoteAddr());
        auth.logout(previousToken);
        sockets.closeForSession(previousToken);
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header(HttpHeaders.SET_COOKIE, cookie(result.token(), request).toString())
                .body(new AuthState(result.account()));
    }
    @PostMapping("/logout") public ResponseEntity<Void> logout(HttpServletRequest request,
            @RequestHeader(value = "X-Caro-Request", required = false) String requestedBy,
            @CookieValue(name = AuthService.COOKIE, required = false) String token) {
        checkRequest(request, requestedBy);
        auth.logout(token);
        sockets.closeForSession(token);
        return ResponseEntity.noContent().header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header(HttpHeaders.SET_COOKIE, cookie("", request).toString()).build();
    }
    @ExceptionHandler(AuthService.AuthError.class)
    public ResponseEntity<Map<String, String>> authError(AuthService.AuthError error) {
        return ResponseEntity.status(error.status).body(Map.of("message", error.getMessage()));
    }
}
