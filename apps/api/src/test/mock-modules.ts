/**
 * Module mocks — registered in a Vitest setupFile so vi.mock() is
 * properly hoisted before any route/service imports.
 *
 * This file is listed FIRST in vitest.config setupFiles so mocks are
 * in place before setup.ts runs and before any test file loads its imports.
 */
import { vi } from "vitest";

// WebSocket broadcast → no-op spy; wsPlugin → no-op
vi.mock("../ws/index.js", () => ({
  broadcast: vi.fn(),
  wsPlugin: async () => {},
}));

// Bot service registry → null (no test-agents in tests)
vi.mock("../bot-service-registry.js", () => ({
  getBotService: () => null,
  setBotService: vi.fn(),
}));

// LLM text-answer evaluation → mock evaluateTextAnswers only; preserve other exports (parseEvalResponse)
vi.mock("../services/llm/evaluate-text-answer.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/llm/evaluate-text-answer.js")>();
  return {
    ...actual,
    evaluateTextAnswers: vi.fn().mockResolvedValue([]),
  };
});
