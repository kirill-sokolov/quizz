import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // Treat import.meta.env.VITE_* as test env vars
    env: {
      VITE_TELEGRAM_BOT_USERNAME: "testbot",
      VITE_API_URL: "http://localhost",
    },
    coverage: {
      provider: "v8",
      include: ["src/components/TV/**", "src/pages/TV.jsx", "src/pages/Game.jsx"],
    },
  },
});
