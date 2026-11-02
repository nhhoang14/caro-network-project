package com.caroclub;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CaroApplication {
    public static void main(String[] args) {
        SpringApplication.run(CaroApplication.class, args);
    }
}
