import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const backendPort = process.env.BACKEND_PORT || process.env.PORT || "8000";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      "/ws": {
        target: `ws://localhost:${backendPort}`,
        ws: true,
        configure(proxy) {
          proxy.on("proxyReqWs", (proxyReq, req) => {
            if (req.headers.host) proxyReq.setHeader("host", req.headers.host);
          });
        },
      },
      "/api": {
        target: `http://localhost:${backendPort}`,
        changeOrigin: false,
        configure(proxy) {
          proxy.on("proxyReq", (proxyReq, req) => {
            if (req.headers.host) proxyReq.setHeader("host", req.headers.host);
          });
        },
      },
      "/health": `http://localhost:${backendPort}`,
    },
  },
});
