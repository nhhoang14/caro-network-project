package com.caroclub;

import java.util.Date;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("auth_sessions")
public class AuthSession {
    @Id public String id;
    @Indexed public String accountId;
    @Indexed(expireAfter = "0s") public Date expiresAt;

    public AuthSession() {}
    public AuthSession(String id, String accountId, Date expiresAt) {
        this.id = id;
        this.accountId = accountId;
        this.expiresAt = expiresAt;
    }
}
