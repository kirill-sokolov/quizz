import { describe, test, expect, beforeEach, vi } from "vitest";
import type { Bot } from "grammy";

vi.mock("../../config.js", () => ({
  config: { BOT_TOKEN: "test-token", API_URL: "http://localhost:3000" },
}));
vi.mock("../../api-client.js", () => ({
  api: {
    getGameState: vi.fn(),
    getAnswers: vi.fn(),
    getTeamDetails: vi.fn(),
  },
}));

import { api } from "../../api-client.js";
import { clearAllState, setState, getState } from "../../state.js";
import { handleEvent } from "../../ws-listener.js";

const mockApi = vi.mocked(api);

function makeMockBot() {
  return {
    api: { sendMessage: vi.fn().mockResolvedValue({}) },
  } as unknown as Bot;
}

function makeChoiceQuestion(overrides = {}) {
  return {
    id: 3, text: "Вопрос?",
    options: ["Вариант A", "Вариант B", "Вариант C", "Вариант D"],
    correctAnswer: "B", timeLimitSec: 30,
    questionType: "choice" as const, weight: 1,
    ...overrides,
  };
}

describe("ws-listener: handleEvent", () => {
  let bot: Bot;

  beforeEach(() => {
    clearAllState();
    vi.resetAllMocks();
    bot = makeMockBot();
  });

  // ── slide_changed ──────────────────────────────────────────────────────────

  describe("slide_changed/question", () => {
    test("no messages sent (bot is silent on question slide)", async () => {
      setState(1, { step: "registered", quizId: 10, teamId: 5 });
      await handleEvent(bot, "slide_changed", { quizId: 10, questionId: 3, slide: "question" });
      expect((bot.api.sendMessage as any)).not.toHaveBeenCalled();
    });

    test("no registered users → nothing sent", async () => {
      await handleEvent(bot, "slide_changed", { quizId: 10, questionId: 3, slide: "question" });
      expect((bot.api.sendMessage as any)).not.toHaveBeenCalled();
    });
  });

  describe("slide_changed/timer", () => {
    test("sends question with buttons to all registered users of that quiz", async () => {
      setState(1, { step: "registered", quizId: 10, teamId: 5 });
      setState(2, { step: "registered", quizId: 10, teamId: 6 });
      setState(3, { step: "registered", quizId: 99, teamId: 7 }); // other quiz
      mockApi.getGameState.mockResolvedValue({
        status: "playing", currentQuestionId: 3,
        currentSlide: "timer",
        question: makeChoiceQuestion(),
      });

      await handleEvent(bot, "slide_changed", { quizId: 10, questionId: 3, slide: "timer" });

      expect((bot.api.sendMessage as any)).toHaveBeenCalledTimes(2);
      expect((bot.api.sendMessage as any)).toHaveBeenCalledWith(1, expect.stringContaining("Вопрос?"), expect.any(Object));
      expect((bot.api.sendMessage as any)).toHaveBeenCalledWith(2, expect.stringContaining("Вопрос?"), expect.any(Object));
    });

    test("sets awaiting_answer state for registered users", async () => {
      setState(1, { step: "registered", quizId: 10, teamId: 5 });
      mockApi.getGameState.mockResolvedValue({
        status: "playing", currentQuestionId: 3, currentSlide: "timer",
        question: makeChoiceQuestion(),
      });

      await handleEvent(bot, "slide_changed", { quizId: 10, questionId: 3, slide: "timer" });

      expect(getState(1)).toEqual({
        step: "awaiting_answer", quizId: 10, teamId: 5,
        questionId: 3, questionType: "choice",
      });
    });

    test("text question → message without inline keyboard, includes hint", async () => {
      setState(1, { step: "registered", quizId: 10, teamId: 5 });
      mockApi.getGameState.mockResolvedValue({
        status: "playing", currentQuestionId: 3, currentSlide: "timer",
        question: makeChoiceQuestion({ questionType: "text", options: [], correctAnswer: "Париж" }),
      });

      await handleEvent(bot, "slide_changed", { quizId: 10, questionId: 3, slide: "timer" });

      const [, msgText, msgOpts] = (bot.api.sendMessage as any).mock.calls[0];
      expect(msgText).toContain("Напиши ответ");
      expect(msgOpts?.reply_markup).toBeUndefined();
    });

    test("text question with multiple answers → hint includes count", async () => {
      setState(1, { step: "registered", quizId: 10, teamId: 5 });
      mockApi.getGameState.mockResolvedValue({
        status: "playing", currentQuestionId: 3, currentSlide: "timer",
        question: makeChoiceQuestion({ questionType: "text", options: [], correctAnswer: "Париж, Берлин" }),
      });

      await handleEvent(bot, "slide_changed", { quizId: 10, questionId: 3, slide: "timer" });

      const [, msgText] = (bot.api.sendMessage as any).mock.calls[0];
      expect(msgText).toContain("2 ответа");
    });

    test("API error → no messages sent", async () => {
      setState(1, { step: "registered", quizId: 10, teamId: 5 });
      mockApi.getGameState.mockRejectedValue(new Error("fail"));

      await handleEvent(bot, "slide_changed", { quizId: 10, questionId: 3, slide: "timer" });

      expect((bot.api.sendMessage as any)).not.toHaveBeenCalled();
    });
  });

  describe("slide_changed/answer", () => {
    test("correct answer → sends '✅ Правильно' to team", async () => {
      setState(1, { step: "awaiting_answer", quizId: 10, teamId: 5, questionId: 3 });
      mockApi.getGameState.mockResolvedValue({
        status: "playing", currentQuestionId: 3, currentSlide: "answer",
        question: makeChoiceQuestion({ correctAnswer: "B" }),
      });
      mockApi.getAnswers.mockResolvedValue([{ teamId: 5, answerText: "B" }]);

      await handleEvent(bot, "slide_changed", { quizId: 10, questionId: 3, slide: "answer" });

      expect((bot.api.sendMessage as any)).toHaveBeenCalledWith(
        1, expect.stringContaining("✅")
      );
      expect(getState(1)).toEqual({ step: "registered", quizId: 10, teamId: 5 });
    });

    test("wrong answer → sends '❌ Неправильно' with correct answer", async () => {
      setState(1, { step: "awaiting_answer", quizId: 10, teamId: 5, questionId: 3 });
      mockApi.getGameState.mockResolvedValue({
        status: "playing", currentQuestionId: 3, currentSlide: "answer",
        question: makeChoiceQuestion({ correctAnswer: "B" }),
      });
      mockApi.getAnswers.mockResolvedValue([{ teamId: 5, answerText: "A" }]);

      await handleEvent(bot, "slide_changed", { quizId: 10, questionId: 3, slide: "answer" });

      const [, msg] = (bot.api.sendMessage as any).mock.calls[0];
      expect(msg).toContain("❌");
      expect(msg).toContain("B"); // correct answer shown
    });

    test("team did not answer → no message sent to them", async () => {
      setState(1, { step: "awaiting_answer", quizId: 10, teamId: 5, questionId: 3 });
      mockApi.getGameState.mockResolvedValue({
        status: "playing", currentQuestionId: 3, currentSlide: "answer",
        question: makeChoiceQuestion(),
      });
      mockApi.getAnswers.mockResolvedValue([]); // no answers

      await handleEvent(bot, "slide_changed", { quizId: 10, questionId: 3, slide: "answer" });

      expect((bot.api.sendMessage as any)).not.toHaveBeenCalled();
      expect(getState(1)).toEqual({ step: "registered", quizId: 10, teamId: 5 });
    });

    test("text question → sends score", async () => {
      setState(1, { step: "awaiting_answer", quizId: 10, teamId: 5, questionId: 3 });
      mockApi.getGameState.mockResolvedValue({
        status: "playing", currentQuestionId: 3, currentSlide: "answer",
        question: makeChoiceQuestion({ questionType: "text", correctAnswer: "Париж" }),
      });
      mockApi.getAnswers.mockResolvedValue([{ teamId: 5, answerText: "Париж", awardedScore: 1 }]);

      await handleEvent(bot, "slide_changed", { quizId: 10, questionId: 3, slide: "answer" });

      const [, msg] = (bot.api.sendMessage as any).mock.calls[0];
      expect(msg).toContain("Оценка:");
    });
  });

  // ── team_kicked ────────────────────────────────────────────────────────────

  describe("team_kicked", () => {
    test("sends kick message and deletes state", async () => {
      setState(10, { step: "registered", quizId: 1, teamId: 77 });

      await handleEvent(bot, "team_kicked", { teamId: 77, name: "Bad Team" });

      expect((bot.api.sendMessage as any)).toHaveBeenCalledWith(
        10, expect.stringContaining("исключён")
      );
      expect(getState(10)).toEqual({ step: "idle" });
    });

    test("unknown teamId → no message", async () => {
      await handleEvent(bot, "team_kicked", { teamId: 999, name: "Unknown" });
      expect((bot.api.sendMessage as any)).not.toHaveBeenCalled();
    });
  });

  // ── quiz_finished ──────────────────────────────────────────────────────────

  describe("quiz_finished", () => {
    test("sends overall results + team details, clears state", async () => {
      setState(1, { step: "registered", quizId: 10, teamId: 5 });
      mockApi.getTeamDetails.mockResolvedValue({
        teamId: 5, teamName: "Команда А", totalCorrect: 2, totalQuestions: 3,
        details: [
          { questionId: 1, questionText: "Q1", options: ["a"], teamAnswer: "A",
            teamAnswerText: "a", correctAnswer: "A", correctAnswerText: "a", isCorrect: true },
        ],
      });

      const results = [
        { teamId: 5, name: "Команда А", correct: 2, total: 3, fastest: null },
        { teamId: 6, name: "Команда Б", correct: 1, total: 3, fastest: null },
      ];
      await handleEvent(bot, "quiz_finished", { quizId: 10, results });

      // Should send overall results + details = 2 messages
      expect((bot.api.sendMessage as any)).toHaveBeenCalledTimes(2);
      const firstMsg = (bot.api.sendMessage as any).mock.calls[0][1];
      expect(firstMsg).toContain("🏆");
      expect(firstMsg).toContain("Команда А");
      expect(getState(1)).toEqual({ step: "idle" });
    });

    test("no registered users for quiz → no messages", async () => {
      setState(1, { step: "registered", quizId: 99, teamId: 5 }); // different quiz
      await handleEvent(bot, "quiz_finished", {
        quizId: 10,
        results: [{ teamId: 5, name: "A", correct: 1, total: 1, fastest: null }],
      });
      expect((bot.api.sendMessage as any)).not.toHaveBeenCalled();
    });
  });

  // ── remind ─────────────────────────────────────────────────────────────────

  describe("remind", () => {
    test("sends reminder to teams with telegramChatId", async () => {
      setState(1, { step: "registered", quizId: 10, teamId: 5 });
      mockApi.getGameState.mockResolvedValue({
        status: "playing", currentQuestionId: 7, currentSlide: "timer",
        question: makeChoiceQuestion(),
      });

      await handleEvent(bot, "remind", {
        quizId: 10,
        teams: [{ teamId: 5, telegramChatId: 1 }],
      });

      expect((bot.api.sendMessage as any)).toHaveBeenCalledWith(
        1, expect.stringContaining("напоминает"), expect.any(Object)
      );
    });

    test("sets awaiting_answer state for reminded teams", async () => {
      setState(1, { step: "registered", quizId: 10, teamId: 5 });
      mockApi.getGameState.mockResolvedValue({
        status: "playing", currentQuestionId: 7, currentSlide: "timer",
        question: makeChoiceQuestion(),
      });

      await handleEvent(bot, "remind", {
        quizId: 10,
        teams: [{ teamId: 5, telegramChatId: 1 }],
      });

      expect(getState(1)).toMatchObject({ step: "awaiting_answer", questionId: 7 });
    });

    test("skips teams with null telegramChatId", async () => {
      mockApi.getGameState.mockResolvedValue({
        status: "playing", currentQuestionId: 7, currentSlide: "timer",
        question: makeChoiceQuestion(),
      });

      await handleEvent(bot, "remind", {
        quizId: 10,
        teams: [{ teamId: 5, telegramChatId: null }],
      });

      expect((bot.api.sendMessage as any)).not.toHaveBeenCalled();
    });
  });

  // ── unknown event ──────────────────────────────────────────────────────────

  test("unknown event → nothing happens", async () => {
    await handleEvent(bot, "some_unknown_event", {});
    expect((bot.api.sendMessage as any)).not.toHaveBeenCalled();
  });
});
