package com.caroclub;

import static org.junit.jupiter.api.Assertions.*;

import com.caroclub.util.ConnectionPolicy;

import java.net.InetAddress;
import org.junit.jupiter.api.Test;

class ConnectionPolicyTest {
    @Test void normalizesPublicOriginsAndRejectsUrlsWithExtraParts() {
        assertEquals("https://caro.example.com", ConnectionPolicy.normalizePublicUrl("https://caro.example.com/"));
        assertEquals("", ConnectionPolicy.normalizePublicUrl(""));
        for (String value : new String[] {
                "javascript:alert(1)", "ftp://example.com", "https://u:p@example.com",
                "https://example.com/path", "https://example.com?token=a", "https://example.com/#hash"
        }) assertThrows(IllegalArgumentException.class, () -> ConnectionPolicy.normalizePublicUrl(value));
    }

    @Test void acceptsSameHostOrConfiguredPublicOriginOnly() {
        assertTrue(ConnectionPolicy.allowedOrigin("http://192.168.1.197:3001", "192.168.1.197:3001", ""));
        assertTrue(ConnectionPolicy.allowedOrigin("http://192.168.1.163:3000", "localhost:8000", ""));
        assertTrue(ConnectionPolicy.allowedOrigin("https://caro.example.com", "localhost:3001", "https://caro.example.com"));
        assertFalse(ConnectionPolicy.allowedOrigin("https://evil.example.com", "localhost:3001", "https://caro.example.com"));
        assertFalse(ConnectionPolicy.allowedOrigin("null", "localhost:3001", ""));
        assertTrue(ConnectionPolicy.allowedOrigin(null, "localhost:3001", ""));
    }

    @Test void recognizesPrivateOrLoopbackHosts() {
        assertTrue(ConnectionPolicy.isPrivateOrLoopback("localhost"));
        assertTrue(ConnectionPolicy.isPrivateOrLoopback("127.0.0.1"));
        assertTrue(ConnectionPolicy.isPrivateOrLoopback("192.168.1.10"));
        assertTrue(ConnectionPolicy.isPrivateOrLoopback("10.0.0.1"));
        assertTrue(ConnectionPolicy.isPrivateOrLoopback("172.16.0.1"));
        assertFalse(ConnectionPolicy.isPrivateOrLoopback("8.8.8.8"));
        assertFalse(ConnectionPolicy.isPrivateOrLoopback("evil.com"));
    }

    @Test void recognizesPrivateIpv4RangesAndInterfacePriority() throws Exception {
        assertTrue(ConnectionPolicy.isPrivateIpv4(InetAddress.getByName("10.0.0.2")));
        assertTrue(ConnectionPolicy.isPrivateIpv4(InetAddress.getByName("172.20.0.1")));
        assertTrue(ConnectionPolicy.isPrivateIpv4(InetAddress.getByName("192.168.1.197")));
        assertFalse(ConnectionPolicy.isPrivateIpv4(InetAddress.getByName("8.8.8.8")));
        assertFalse(ConnectionPolicy.isPrivateIpv4(InetAddress.getByName("127.0.0.1")));
        assertEquals(0, ConnectionPolicy.interfacePriority("Wi-Fi"));
        assertEquals(1, ConnectionPolicy.interfacePriority("Ethernet"));
        assertEquals(2, ConnectionPolicy.interfacePriority("vEthernet"));
    }
}
