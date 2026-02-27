import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      BOT_TOKEN: "test-token",
      API_URL: "http://localhost:3000",
    },
    coverage: {
      provider: "v8",
      include: [
        "src/state.ts",
        "src/api-client.ts",
        "src/handlers/start.ts",
        "src/handlers/captain.ts",
        "src/ws-listener.ts",
      ],
      exclude: ["src/test/**"],
    },
  },
});
