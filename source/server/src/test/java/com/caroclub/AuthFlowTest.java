package com.caroclub;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.caroclub.controller.AuthController;
import com.caroclub.service.AuthService;
import com.caroclub.websocket.CaroSocketHandler;

import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.mock.web.MockHttpServletRequest;

class AuthFlowTest {
    @Test void rejectsInvalidCredentialsBeforeWritingToMongo() {
        MongoTemplate mongo = mock(MongoTemplate.class);
        AuthService auth = new AuthService(mongo);
        assertEquals(400, assertThrows(AuthService.AuthError.class, () -> auth.register("tên có dấu", "password123")).status);
        assertEquals(400, assertThrows(AuthService.AuthError.class, () -> auth.register("player", "short")).status);
        verifyNoInteractions(mongo);
    }

    @Test void cookieParserReadsOnlyItsOwnCookie() {
        assertEquals("abc", AuthService.cookieToken("other=123; caro_auth=abc; theme=dark"));
        assertNull(AuthService.cookieToken("other=123"));
    }

    @Test void blocksCrossOriginAndMissingCustomHeaderBeforeRegistering() {
        AuthService auth = mock(AuthService.class);
        CaroSocketHandler sockets = mock(CaroSocketHandler.class);
        AuthController controller = new AuthController(auth, sockets, "");
        MockHttpServletRequest otherOrigin = request("https://evil.example");
        AuthController.Credentials credentials = new AuthController.Credentials("player", "password123");
        assertEquals(403, assertThrows(AuthService.AuthError.class,
                () -> controller.register(credentials, otherOrigin, "1", null)).status);
        MockHttpServletRequest sameOrigin = request("http://localhost:3000");
        assertEquals(403, assertThrows(AuthService.AuthError.class,
                () -> controller.register(credentials, sameOrigin, null, null)).status);
        verifyNoInteractions(auth);
    }

    @Test void setsHttpOnlySessionCookieForSameOriginRegistration() {
        AuthService auth = mock(AuthService.class);
        CaroSocketHandler sockets = mock(CaroSocketHandler.class);
        AuthController controller = new AuthController(auth, sockets, "");
        AuthService.AccountView view = new AuthService.AccountView("id", "player", "Player", "profile");
        when(auth.register("player", "password123")).thenReturn(new AuthService.LoginResult(view, "token"));
        var response = controller.register(new AuthController.Credentials("player", "password123"),
                request("http://localhost:3000"), "1", null);
        String cookie = response.getHeaders().getFirst("Set-Cookie");
        assertNotNull(cookie);
        assertTrue(cookie.contains("HttpOnly"));
        assertTrue(cookie.contains("SameSite=Lax"));
        assertEquals("no-store", response.getHeaders().getFirst("Cache-Control"));
    }

    private MockHttpServletRequest request(String origin) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/register");
        request.setScheme("http");
        request.addHeader("Host", "localhost:3000");
        request.addHeader("Origin", origin);
        return request;
    }
}
