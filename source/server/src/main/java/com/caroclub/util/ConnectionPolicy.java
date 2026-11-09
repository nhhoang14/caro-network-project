package com.caroclub.util;

import java.net.Inet4Address;
import java.net.URI;

/** Shared validation for public/LAN URLs and browser origins. */
public final class ConnectionPolicy {
    private ConnectionPolicy() {}

    public static String normalizePublicUrl(String value) {
        if (value == null || value.isBlank()) return "";
        URI url = URI.create(value);
        String scheme = url.getScheme();
        boolean validScheme = "http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme);
        boolean originOnly = url.getRawUserInfo() == null
                && (url.getPath() == null || url.getPath().isEmpty() || "/".equals(url.getPath()))
                && url.getRawQuery() == null && url.getRawFragment() == null && url.getHost() != null;
        if (!validScheme || !originOnly) {
            throw new IllegalArgumentException("PUBLIC_URL must be an HTTP(S) origin");
        }
        int port = url.getPort();
        return scheme.toLowerCase() + "://" + url.getHost()
                + (port < 0 ? "" : ":" + port);
    }

    public static boolean allowedOrigin(String origin, String host, String publicUrl) {
        if (origin == null) return true;
        try {
            URI url = URI.create(origin);
            String scheme = url.getScheme();
            if (!("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))
                    || url.getRawUserInfo() != null
                    || url.getRawQuery() != null
                    || url.getRawFragment() != null
                    || url.getPath() != null && !url.getPath().isEmpty()) return false;
            if (url.getAuthority() != null && url.getAuthority().equalsIgnoreCase(host)) return true;
            if (!publicUrl.isBlank() && origin.equals(publicUrl)) return true;
            if (isPrivateOrLoopback(url.getHost())) {
                String hostName = host != null ? (host.contains(":") ? host.substring(0, host.indexOf(':')) : host) : "";
                if (isPrivateOrLoopback(hostName)) return true;
            }
            return false;
        } catch (IllegalArgumentException error) {
            return false;
        }
    }

    public static boolean isPrivateOrLoopback(String hostName) {
        if (hostName == null || hostName.isBlank()) return false;
        if ("localhost".equalsIgnoreCase(hostName) || hostName.endsWith(".localhost")
                || "[::1]".equals(hostName) || "::1".equals(hostName)) {
            return true;
        }
        String[] parts = hostName.split("\\.");
        if (parts.length == 4) {
            try {
                int first = Integer.parseInt(parts[0]);
                int second = Integer.parseInt(parts[1]);
                int third = Integer.parseInt(parts[2]);
                int fourth = Integer.parseInt(parts[3]);
                if (first < 0 || first > 255 || second < 0 || second > 255
                        || third < 0 || third > 255 || fourth < 0 || fourth > 255) return false;
                if (first == 127) return true;
                return first == 10 || (first == 172 && second >= 16 && second <= 31) || (first == 192 && second == 168);
            } catch (NumberFormatException ignored) {
                return false;
            }
        }
        return false;
    }

    public static boolean isPrivateIpv4(java.net.InetAddress address) {
        if (!(address instanceof Inet4Address) || address.isLoopbackAddress()) return false;
        byte[] bytes = address.getAddress();
        int first = bytes[0] & 255;
        int second = bytes[1] & 255;
        return first == 10 || first == 172 && second >= 16 && second <= 31
                || first == 192 && second == 168;
    }

    public static int interfacePriority(String name) {
        if (name != null && name.matches("(?i).*wi-?fi.*|.*wlan.*|.*wireless.*")) return 0;
        if (name != null && name.matches("(?i).*virtual.*|.*vethernet.*|.*docker.*|.*wsl.*|.*vpn.*")) return 2;
        return 1;
    }
}

