package com.caroclub;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("accounts")
public class Account {
    @Id public String id;
    @Indexed(unique = true) public String username;
    public String passwordHash;
    public String profileId;

    public Account() {}
    public Account(String id, String username, String passwordHash, String profileId) {
        this.id = id;
        this.username = username;
        this.passwordHash = passwordHash;
        this.profileId = profileId;
    }
}
