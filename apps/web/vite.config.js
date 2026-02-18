import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.API_URL || "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
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
    },
  },
});
