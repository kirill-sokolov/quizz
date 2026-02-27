import { defineConfig } from "vitest/config";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://wedding:wedding@wedding_db:5432/quiz_test";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: ["./src/test/global-setup.ts"],
    // mock-modules.ts MUST be first so vi.mock() is hoisted before any imports
    setupFiles: ["./src/test/mock-modules.ts", "./src/test/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Run test files sequentially — they share the same quiz_test database.
    // Each file still gets its own fork (own module cache / mock instances),
    // but files don't run concurrently → no cross-file DB contamination.
    fileParallelism: false,
    env: {
      DATABASE_URL: TEST_DB_URL,
      NODE_ENV: "test",
      PORT: "3001",
      HOST: "127.0.0.1",
      MEDIA_DIR: "/tmp/wedding-quiz-test-uploads",
      JWT_SECRET: "test-secret",
      OPENROUTER_API_KEY: "test-key",
      GEMINI_API_KEY: "test-key",
      GROQ_API_KEY: "test-key",
    },
    coverage: {
      provider: "v8",
      // Core business logic only — exclude import pipeline, media upload, docx/llm infrastructure
      include: [
        "src/services/game-service.ts",
        "src/routes/game.ts",
        "src/routes/answers.ts",
        "src/routes/teams.ts",
        "src/routes/auth.ts",
        "src/routes/quizzes.ts",
        "src/routes/questions.ts",
        "src/routes/admin.ts",
        "src/services/llm/evaluate-text-answer.ts",
      ],
      exclude: ["src/test/**", "src/test-agents/**"],
    },
  },
});
