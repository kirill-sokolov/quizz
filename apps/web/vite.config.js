import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.API_URL || "http://wedding_api:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: ['.ngrok-free.app', '.ngrok.io', 'localhost'],
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on("error", (err, req, res) => {
            console.error("[vite proxy error]", err.message, req.url);
          });
          proxy.on("proxyRes", (proxyRes, req) => {
            const status = proxyRes.statusCode;
            if (status >= 400) {
              console.error("[vite proxy] %s %s -> %d", req.method, req.url, status);
            }
          });
        },
      },
      "/ws": {
        target: apiTarget.replace(/^http/, "ws"),
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
