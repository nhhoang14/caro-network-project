package com.caroclub.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("profiles")
public class Profile {
    @Id public String id;
    @Indexed(unique = true) public String tokenHash;
    public String name;

    public Profile() {}
    public Profile(String id, String tokenHash, String name) {
        this.id = id;
        this.tokenHash = tokenHash;
        this.name = name;
    }
}

