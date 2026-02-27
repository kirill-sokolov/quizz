import { describe, test, expect, beforeEach, vi } from "vitest";

vi.mock("../../config.js", () => ({
  config: { BOT_TOKEN: "test-token", API_URL: "http://localhost:3000" },
}));

import { api } from "../../api-client.js";

function mockFetch(data: unknown, status = 200) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

describe("api-client", () => {
  beforeEach(() => vi.resetAllMocks());

  test("getActiveQuizzes calls /api/quizzes/active", async () => {
    mockFetch([{ id: 1, title: "Q", status: "active", joinCode: "ABC" }]);
    const result = await api.getActiveQuizzes();
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/quizzes/active",
      expect.any(Object)
    );
    expect(result).toHaveLength(1);
  });

  test("getQuizByCode calls correct path", async () => {
    mockFetch({ id: 1, title: "Q", status: "active", joinCode: "XYZ" });
    await api.getQuizByCode("XYZ");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/quizzes/by-code/XYZ",
      expect.any(Object)
    );
  });

  test("registerTeam POSTs to correct path with correct body", async () => {
    mockFetch({ id: 5, quizId: 1, name: "Team A", telegramChatId: 123, isKicked: false });
    await api.registerTeam(1, "Team A", 123);
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("http://localhost:3000/api/quizzes/1/teams");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ name: "Team A", telegramChatId: 123 });
  });

  test("submitAnswer POSTs to /api/answers with correct body", async () => {
    mockFetch({ id: 10, questionId: 5, teamId: 3, answerText: "A" });
    await api.submitAnswer(5, 3, "A");
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("http://localhost:3000/api/answers");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ questionId: 5, teamId: 3, answerText: "A" });
  });

  test("getGameState calls correct path", async () => {
    mockFetch({ id: 1, quizId: 10, status: "playing" });
    await api.getGameState(10);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/game/state/10",
      expect.any(Object)
    );
  });

  test("throws error with .status property on non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      text: () => Promise.resolve("Conflict"),
    });
    await expect(api.submitAnswer(1, 1, "A")).rejects.toMatchObject({ status: 409 });
  });

  test("error message includes status code", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Not found"),
    });
    await expect(api.getActiveQuizzes()).rejects.toThrow("404");
  });

  test("getAnswers calls correct path", async () => {
    mockFetch([]);
    await api.getAnswers(7);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/questions/7/answers",
      expect.any(Object)
    );
  });

  test("getTeamDetails calls correct path", async () => {
    mockFetch({ teamId: 1, teamName: "A", totalCorrect: 2, totalQuestions: 3, details: [] });
    await api.getTeamDetails(5, 3);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/game/results/5/3",
      expect.any(Object)
    );
  });
});
