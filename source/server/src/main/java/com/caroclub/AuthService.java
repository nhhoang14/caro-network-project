package com.caroclub;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Date;
import java.util.HexFormat;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    public static final String COOKIE = "caro_auth";
    public static final Duration SESSION_LIFETIME = Duration.ofDays(30);
    private static final BCryptPasswordEncoder PASSWORDS = new BCryptPasswordEncoder(12);
    private static final String DUMMY_HASH = PASSWORDS.encode("dummy-password-for-unknown-user");
    private final MongoTemplate mongo;
    private final SecureRandom random = new SecureRandom();
    private final ConcurrentHashMap<String, Attempts> attempts = new ConcurrentHashMap<>();

    public AuthService(MongoTemplate mongo) { this.mongo = mongo; }
    public record AccountView(String id, String username, String name, String profileId) {}
    public record LoginResult(AccountView account, String token) {}
    private record Attempts(int count, long until) {}
    public static class AuthError extends RuntimeException {
        public final int status;
        public AuthError(int status, String message) { super(message); this.status = status; }
    }

    private static String digest(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    private String randomToken() {
        byte[] bytes = new byte[32]; random.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
    private static String username(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase(java.util.Locale.ROOT);
        if (!normalized.matches("[a-z0-9_]{3,24}"))
            throw new AuthError(400, "Tên tài khoản cần 3–24 ký tự: chữ thường, số hoặc dấu gạch dưới.");
        return normalized;
    }
    private static void checkPassword(String password) {
        if (password == null || password.length() < 8 || password.getBytes(StandardCharsets.UTF_8).length > 72)
            throw new AuthError(400, "Mật khẩu cần ít nhất 8 ký tự và không quá 72 byte.");
    }
    private AccountView view(Account account) {
        Profile profile = mongo.findById(account.profileId, Profile.class);
        if (profile == null) throw new AuthError(401, "Tài khoản không còn hợp lệ.");
        return new AccountView(account.id, account.username, profile.name, profile.id);
    }
    private LoginResult issue(Account account) {
        String token = randomToken();
        mongo.insert(new AuthSession(digest(token), account.id, Date.from(java.time.Instant.now().plus(SESSION_LIFETIME))));
        return new LoginResult(view(account), token);
    }
    public LoginResult register(String rawUsername, String password) {
        String user = username(rawUsername);
        checkPassword(password);
        if (mongo.exists(Query.query(Criteria.where("username").is(user)), Account.class))
            throw new AuthError(409, "Tên tài khoản đã được sử dụng.");
        String profileId = UUID.randomUUID().toString();
        Account account = new Account(UUID.randomUUID().toString(), user, PASSWORDS.encode(password), profileId);
        // A distinct account profile keeps a guest token from granting access to account history.
        Profile profile = new Profile(profileId, "account:" + UUID.randomUUID(), user);
        mongo.insert(profile);
        try { mongo.insert(account); }
        catch (org.springframework.dao.DuplicateKeyException e) {
            mongo.remove(profile);
            throw new AuthError(409, "Tên tài khoản đã được sử dụng.");
        }
        return issue(account);
    }
    public LoginResult login(String rawUsername, String password, String remoteAddress) {
        String user = username(rawUsername);
        if (password == null || password.length() > 256) throw new AuthError(401, "Tên tài khoản hoặc mật khẩu không đúng.");
        String key = remoteAddress + ":" + user;
        Attempts existing = attempts.get(key);
        if (existing != null && existing.count >= 5 && existing.until > System.currentTimeMillis())
            throw new AuthError(429, "Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 5 phút.");
        Account account = mongo.findOne(Query.query(Criteria.where("username").is(user)), Account.class);
        if (!PASSWORDS.matches(password, account == null ? DUMMY_HASH : account.passwordHash)) {
            attempts.compute(key, (k, old) -> new Attempts(old == null || old.until < System.currentTimeMillis() ? 1 : old.count + 1,
                    System.currentTimeMillis() + Duration.ofMinutes(5).toMillis()));
            throw new AuthError(401, "Tên tài khoản hoặc mật khẩu không đúng.");
        }
        attempts.remove(key);
        return issue(account);
    }
    public AccountView fromToken(String token) {
        if (token == null || !token.matches("[a-f0-9]{64}")) return null;
        AuthSession session = mongo.findById(digest(token), AuthSession.class);
        if (session == null || !session.expiresAt.after(new Date())) return null;
        Account account = mongo.findById(session.accountId, Account.class);
        return account == null ? null : view(account);
    }
    public void logout(String token) {
        if (token != null && token.matches("[a-f0-9]{64}")) mongo.remove(Query.query(Criteria.where("_id").is(digest(token))), AuthSession.class);
    }
    public static String cookieToken(String header) {
        if (header == null) return null;
        for (String item : header.split(";")) {
            String part = item.trim();
            if (part.startsWith(COOKIE + "=")) return part.substring(COOKIE.length() + 1);
        }
        return null;
    }
}
