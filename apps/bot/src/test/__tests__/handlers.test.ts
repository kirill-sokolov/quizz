import { describe, test, expect, beforeEach, vi } from "vitest";

vi.mock("../../config.js", () => ({
  config: { BOT_TOKEN: "test-token", API_URL: "http://localhost:3000" },
}));
vi.mock("../../api-client.js", () => ({
  api: {
    getActiveQuizzes: vi.fn(),
    registerTeam: vi.fn(),
    submitAnswer: vi.fn(),
    getGameState: vi.fn(),
  },
}));

import { api } from "../../api-client.js";
import { clearAllState, getState, setState } from "../../state.js";
import { registerStartHandlers } from "../../handlers/start.js";
import { registerCaptainHandlers } from "../../handlers/captain.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeMockBot() {
  const commands: Record<string, (ctx: any) => Promise<void>> = {};
  const callbacks: Array<[RegExp | string, (ctx: any) => Promise<void>]> = [];
  let textHandler: ((ctx: any) => Promise<void>) | undefined;

  return {
    command(name: string, fn: (ctx: any) => Promise<void>) {
      commands[name] = fn;
    },
    callbackQuery(pattern: RegExp | string, fn: (ctx: any) => Promise<void>) {
      callbacks.push([pattern, fn]);
    },
    on(_event: string, fn: (ctx: any) => Promise<void>) {
      textHandler = fn;
    },
    async triggerCommand(name: string, ctx: any) {
      await commands[name]?.(ctx);
    },
    async triggerCallback(data: string, ctx: any) {
      const entry = callbacks.find(([p]) =>
        typeof p === "string" ? p === data : (p as RegExp).test(data)
      );
      await entry?.[1](ctx);
    },
    async triggerText(ctx: any) {
      await textHandler?.(ctx);
    },
  } as any;
}

function makeCtx(chatId: number, opts: { text?: string; callbackData?: string } = {}) {
  return {
    chat: { id: chatId },
    message: { text: opts.text ?? "" },
    callbackQuery: { data: opts.callbackData ?? "" },
    reply: vi.fn().mockResolvedValue({}),
    answerCallbackQuery: vi.fn().mockResolvedValue({}),
    editMessageText: vi.fn().mockResolvedValue({}),
  };
}

const mockApi = vi.mocked(api);

// ── /start и /reset ───────────────────────────────────────────────────────────

describe("start handler", () => {
  let bot: ReturnType<typeof makeMockBot>;

  beforeEach(() => {
    clearAllState();
    vi.resetAllMocks();
    bot = makeMockBot();
    registerStartHandlers(bot);
    registerCaptainHandlers(bot);
  });

  test("/start → 0 active quizzes → replies 'нет активных квизов'", async () => {
    mockApi.getActiveQuizzes.mockResolvedValue([]);
    const ctx = makeCtx(1);
    await bot.triggerCommand("start", ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("нет активных квизов"));
    expect(getState(1)).toEqual({ step: "idle" });
  });

  test("/start → 1 quiz → sets awaiting_name state, replies with quiz title", async () => {
    mockApi.getActiveQuizzes.mockResolvedValue([
      { id: 10, title: "Свадебный квиз", status: "active", joinCode: "ABC" },
    ]);
    const ctx = makeCtx(1);
    await bot.triggerCommand("start", ctx);
    expect(getState(1)).toEqual({ step: "awaiting_name", quizId: 10 });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("Свадебный квиз"));
  });

  test("/start → 2 quizzes → replies with selection prompt", async () => {
    mockApi.getActiveQuizzes.mockResolvedValue([
      { id: 1, title: "Квиз 1", status: "active", joinCode: "A" },
      { id: 2, title: "Квиз 2", status: "active", joinCode: "B" },
    ]);
    const ctx = makeCtx(1);
    await bot.triggerCommand("start", ctx);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Выбери"),
      expect.any(Object)
    );
    // State stays idle until quiz is picked
    expect(getState(1)).toEqual({ step: "idle" });
  });

  test("/start → API throws → replies error message", async () => {
    mockApi.getActiveQuizzes.mockRejectedValue(new Error("network error"));
    const ctx = makeCtx(1);
    await bot.triggerCommand("start", ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("Ошибка"));
  });

  test("/reset → clears all state, sends confirmation", async () => {
    setState(1, { step: "registered", quizId: 1, teamId: 5 });
    setState(2, { step: "awaiting_name", quizId: 1 });
    const ctx = makeCtx(99);
    await bot.triggerCommand("reset", ctx);
    expect(getState(1)).toEqual({ step: "idle" });
    expect(getState(2)).toEqual({ step: "idle" });
    expect(ctx.reply).toHaveBeenCalled();
  });

  test("pick_quiz callback → sets awaiting_name with correct quizId", async () => {
    const ctx = makeCtx(1, { callbackData: "pick_quiz:42" });
    await bot.triggerCallback("pick_quiz:42", ctx);
    expect(getState(1)).toEqual({ step: "awaiting_name", quizId: 42 });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("название"));
  });
});

// ── captain text handler ──────────────────────────────────────────────────────

describe("captain text handler", () => {
  let bot: ReturnType<typeof makeMockBot>;

  beforeEach(() => {
    clearAllState();
    vi.resetAllMocks();
    bot = makeMockBot();
    registerCaptainHandlers(bot);
  });

  test("awaiting_name + valid name → registers team, state becomes registered", async () => {
    setState(1, { step: "awaiting_name", quizId: 10 });
    mockApi.registerTeam.mockResolvedValue({
      id: 55, quizId: 10, name: "Команда А", telegramChatId: null, isKicked: false,
    });
    const ctx = makeCtx(1, { text: "Команда А" });
    await bot.triggerText(ctx);
    expect(mockApi.registerTeam).toHaveBeenCalledWith(10, "Команда А", 1);
    expect(getState(1)).toEqual({ step: "registered", quizId: 10, teamId: 55 });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("зарегистрирована"));
  });

  test("awaiting_name + empty name → validation error, state unchanged", async () => {
    setState(1, { step: "awaiting_name", quizId: 10 });
    const ctx = makeCtx(1, { text: "" });
    await bot.triggerText(ctx);
    expect(mockApi.registerTeam).not.toHaveBeenCalled();
    expect(getState(1)).toEqual({ step: "awaiting_name", quizId: 10 });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("символ"));
  });

  test("awaiting_name + name > 50 chars → validation error", async () => {
    setState(1, { step: "awaiting_name", quizId: 10 });
    const ctx = makeCtx(1, { text: "А".repeat(51) });
    await bot.triggerText(ctx);
    expect(mockApi.registerTeam).not.toHaveBeenCalled();
  });

  test("awaiting_answer (text question) → submits answer text, state becomes registered", async () => {
    setState(1, { step: "awaiting_answer", quizId: 10, teamId: 5, questionId: 3, questionType: "text" });
    mockApi.submitAnswer.mockResolvedValue({ id: 1, questionId: 3, teamId: 5, answerText: "Париж" });
    const ctx = makeCtx(1, { text: "Париж" });
    await bot.triggerText(ctx);
    expect(mockApi.submitAnswer).toHaveBeenCalledWith(3, 5, "Париж");
    expect(getState(1)).toEqual({ step: "registered", quizId: 10, teamId: 5 });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("принят"));
  });

  test("awaiting_answer (choice) + valid letter → submits uppercase letter", async () => {
    setState(1, { step: "awaiting_answer", quizId: 10, teamId: 5, questionId: 3, questionType: "choice" });
    mockApi.submitAnswer.mockResolvedValue({ id: 1, questionId: 3, teamId: 5, answerText: "B" });
    const ctx = makeCtx(1, { text: "b" });
    await bot.triggerText(ctx);
    expect(mockApi.submitAnswer).toHaveBeenCalledWith(3, 5, "B");
  });

  test("awaiting_answer (choice) + invalid text → error reply, no API call", async () => {
    setState(1, { step: "awaiting_answer", quizId: 10, teamId: 5, questionId: 3, questionType: "choice" });
    const ctx = makeCtx(1, { text: "hello" });
    await bot.triggerText(ctx);
    expect(mockApi.submitAnswer).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("букву"));
  });

  test("awaiting_answer + 409 → 'уже ответил', state becomes registered", async () => {
    setState(1, { step: "awaiting_answer", quizId: 10, teamId: 5, questionId: 3, questionType: "text" });
    const err = Object.assign(new Error("Conflict"), { status: 409 });
    mockApi.submitAnswer.mockRejectedValue(err);
    const ctx = makeCtx(1, { text: "ответ" });
    await bot.triggerText(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("уже ответил"));
    expect(getState(1)).toEqual({ step: "registered", quizId: 10, teamId: 5 });
  });

  test("registered + valid letter + game playing → submits answer", async () => {
    setState(1, { step: "registered", quizId: 10, teamId: 5 });
    mockApi.getGameState.mockResolvedValue({
      status: "playing", currentQuestionId: 7, currentSlide: "timer",
      question: { id: 7, text: "?", options: ["A"], correctAnswer: "A", timeLimitSec: 30, questionType: "choice", weight: 1 },
    });
    mockApi.submitAnswer.mockResolvedValue({ id: 1, questionId: 7, teamId: 5, answerText: "A" });
    const ctx = makeCtx(1, { text: "A" });
    await bot.triggerText(ctx);
    expect(mockApi.submitAnswer).toHaveBeenCalledWith(7, 5, "A");
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("принят"));
  });

  test("registered + game not playing → 'ожидай'", async () => {
    setState(1, { step: "registered", quizId: 10, teamId: 5 });
    mockApi.getGameState.mockResolvedValue({
      status: "lobby", currentQuestionId: null, currentSlide: "question", question: null,
    });
    const ctx = makeCtx(1, { text: "A" });
    await bot.triggerText(ctx);
    expect(mockApi.submitAnswer).not.toHaveBeenCalled();
  });

  test("idle → suggests /start", async () => {
    const ctx = makeCtx(1, { text: "привет" });
    await bot.triggerText(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("/start"));
  });
});

// ── captain callback handler ──────────────────────────────────────────────────

describe("captain callback: answer:X", () => {
  let bot: ReturnType<typeof makeMockBot>;

  beforeEach(() => {
    clearAllState();
    vi.resetAllMocks();
    bot = makeMockBot();
    registerCaptainHandlers(bot);
  });

  test("answer:A when awaiting_answer → submits answer, state becomes registered", async () => {
    setState(1, { step: "awaiting_answer", quizId: 10, teamId: 5, questionId: 3 });
    mockApi.submitAnswer.mockResolvedValue({ id: 1, questionId: 3, teamId: 5, answerText: "A" });
    mockApi.getGameState.mockResolvedValue({
      status: "playing", currentQuestionId: 3,
      question: { id: 3, text: "?", options: ["opt1", "opt2", "opt3", "opt4"], correctAnswer: "A", timeLimitSec: 30, questionType: "choice", weight: 1 },
    });
    const ctx = makeCtx(1, { callbackData: "answer:A" });
    await bot.triggerCallback("answer:A", ctx);
    expect(mockApi.submitAnswer).toHaveBeenCalledWith(3, 5, "A");
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({ text: expect.stringContaining("A") });
    expect(getState(1)).toEqual({ step: "registered", quizId: 10, teamId: 5 });
  });

  test("answer:A when registered + game playing → recovers state and submits", async () => {
    setState(1, { step: "registered", quizId: 10, teamId: 5 });
    mockApi.getGameState.mockResolvedValue({
      status: "playing", currentQuestionId: 7,
      question: { id: 7, text: "?", options: ["a", "b", "c", "d"], correctAnswer: "B", timeLimitSec: 30, questionType: "choice", weight: 1 },
    });
    mockApi.submitAnswer.mockResolvedValue({ id: 1, questionId: 7, teamId: 5, answerText: "A" });
    const ctx = makeCtx(1, { callbackData: "answer:A" });
    await bot.triggerCallback("answer:A", ctx);
    expect(mockApi.submitAnswer).toHaveBeenCalledWith(7, 5, "A");
  });

  test("answer:A when registered + API fails → answerCallbackQuery with warning", async () => {
    setState(1, { step: "registered", quizId: 10, teamId: 5 });
    mockApi.getGameState.mockRejectedValue(new Error("fail"));
    const ctx = makeCtx(1, { callbackData: "answer:A" });
    await bot.triggerCallback("answer:A", ctx);
    expect(mockApi.submitAnswer).not.toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.any(String) })
    );
  });

  test("answer:A + 409 → 'уже ответил', state becomes registered", async () => {
    setState(1, { step: "awaiting_answer", quizId: 10, teamId: 5, questionId: 3 });
    const err = Object.assign(new Error("Conflict"), { status: 409 });
    mockApi.submitAnswer.mockRejectedValue(err);
    mockApi.getGameState.mockResolvedValue({
      status: "playing", currentQuestionId: 3,
      question: { id: 3, text: "?", options: ["a", "b"], correctAnswer: "A", timeLimitSec: 30, questionType: "choice", weight: 1 },
    });
    const ctx = makeCtx(1, { callbackData: "answer:A" });
    await bot.triggerCallback("answer:A", ctx);
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({ text: expect.stringContaining("ответил") });
    expect(getState(1)).toEqual({ step: "registered", quizId: 10, teamId: 5 });
  });

  test("answer:A when idle → answerCallbackQuery with warning", async () => {
    // chatId 1 is idle (no state set)
    const ctx = makeCtx(1, { callbackData: "answer:A" });
    await bot.triggerCallback("answer:A", ctx);
    expect(mockApi.submitAnswer).not.toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });
});
