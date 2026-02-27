import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      BOT_TOKEN: "test-token",
      API_URL: "http://localhost:3000",
    },
  },
});
