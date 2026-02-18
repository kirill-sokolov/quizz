import WebSocket from "ws";
import { Bot, InlineKeyboard } from "grammy";
import { config } from "./config.js";
import { getAllRegistered, getRegisteredByTeamId, setState, deleteState, getState } from "./state.js";
import { api } from "./api-client.js";

const LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export function startWsListener(bot: Bot) {
  const wsUrl = config.API_URL.replace(/^http/, "ws") + "/ws";
  console.log("WS connecting to:", wsUrl);

  function connect() {
    const ws = new WebSocket(wsUrl);

    ws.on("open", () => {
      console.log("WS connected to API");
    });

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        await handleEvent(bot, msg.event, msg.data);
      } catch (err) {
        console.error("WS message error:", err);
      }
    });

    ws.on("close", () => {
      console.log("WS disconnected, reconnecting in 3s...");
      setTimeout(connect, 3000);
    });

    ws.on("error", (err) => {
      console.error("WS error:", err);
    });
  }

  connect();
}

async function handleEvent(bot: Bot, event: string, data: any) {
  switch (event) {
    case "slide_changed":
      await onSlideChanged(bot, data);
      break;
    case "team_kicked":
      await onTeamKicked(bot, data);
      break;
    case "quiz_finished":
      await onQuizFinished(bot, data);
      break;
    case "remind":
      await onRemind(bot, data);
      break;
  }
}

async function onSlideChanged(bot: Bot, data: { quizId: number; questionId: number; slide: string }) {
  const registered = getAllRegistered().filter((u) => u.quizId === data.quizId);
  if (registered.length === 0) return;

  if (data.slide === "question" && data.questionId) {
    let question;
    try {
      const state = await api.getGameState(data.quizId);
      question = state.question;
    } catch {
      return;
    }
    if (!question) return;

    console.log("Question data:", JSON.stringify(question));
    const options = question.options || [];
    const optionLines = options
      .map((opt: string, i: number) => `${LABELS[i]}) ${opt}`)
      .join("\n");

    const text = [
      `❓ Вопрос`,
      "",
      question.text,
      "",
      optionLines,
      "",
      options.length >= 2 && options.length <= 8
        ? "Выбери ответ кнопкой или отправь букву:"
        : "Отправь букву ответа: " + LABELS.slice(0, options.length || 4).join(", "),
    ].join("\n");

    // Кнопки A/B/C/D только для некастомного вопроса (2–8 вариантов)
    const replyMarkup =
      options.length >= 2 && options.length <= 8
        ? (() => {
            const kb = new InlineKeyboard();
            const letters = LABELS.slice(0, options.length);
            for (let i = 0; i < letters.length; i += 2) {
              kb.text(letters[i], `answer:${letters[i]}`);
              if (letters[i + 1]) kb.text(letters[i + 1], `answer:${letters[i + 1]}`);
              if (i + 2 < letters.length) kb.row();
            }
            return kb;
          })()
        : undefined;

    for (const user of registered) {
      setState(user.chatId, {
        step: "awaiting_answer",
        quizId: user.quizId,
        teamId: user.teamId,
        questionId: data.questionId,
      });
      try {
        await bot.api.sendMessage(user.chatId, text, {
          ...(replyMarkup && { reply_markup: replyMarkup }),
        });
      } catch (err) {
        console.error(`Failed to send question to ${user.chatId}:`, err);
      }
    }
  } else if (data.slide === "timer") {
    // Fetch question to build answer buttons
    let timerKb: InlineKeyboard | undefined;
    try {
      const state = await api.getGameState(data.quizId);
      const opts = state.question?.options || [];
      if (opts.length >= 2 && opts.length <= 8) {
        timerKb = new InlineKeyboard();
        const letters = LABELS.slice(0, opts.length);
        for (let i = 0; i < letters.length; i += 2) {
          timerKb.text(letters[i], `answer:${letters[i]}`);
          if (letters[i + 1]) timerKb.text(letters[i + 1], `answer:${letters[i + 1]}`);
          if (i + 2 < letters.length) timerKb.row();
        }
      }
    } catch {
      // no buttons if API fails
    }

    for (const user of registered) {
      // Set awaiting_answer if not already (in case they missed the question slide)
      const st = getState(user.chatId);
      if (st.step === "registered" && data.questionId) {
        setState(user.chatId, {
          step: "awaiting_answer",
          quizId: user.quizId,
          teamId: user.teamId,
          questionId: data.questionId,
        });
      }
      try {
        await bot.api.sendMessage(user.chatId, "⏱ Время пошло! Отправь ответ.", {
          ...(timerKb && { reply_markup: timerKb }),
        });
      } catch (err) {
        console.error(`Failed to send timer to ${user.chatId}:`, err);
      }
    }
  } else if (data.slide === "answer") {
    // When answer slide is shown, move back to registered (no longer awaiting)
    for (const user of registered) {
      const st = getState(user.chatId);
      if (st.step === "awaiting_answer") {
        setState(user.chatId, {
          step: "registered",
          quizId: user.quizId,
          teamId: user.teamId,
        });
      }
    }
  }
}

async function onTeamKicked(bot: Bot, data: { teamId: number; name: string }) {
  const chatId = getRegisteredByTeamId(data.teamId);
  if (!chatId) return;

  deleteState(chatId);
  try {
    await bot.api.sendMessage(chatId, "❌ Ты был исключён из игры.");
  } catch (err) {
    console.error(`Failed to notify kicked team ${data.teamId}:`, err);
  }
}

async function onQuizFinished(
  bot: Bot,
  data: { quizId: number; results: Array<{ teamId: number; name: string; correct: number; total: number }> }
) {
  const registered = getAllRegistered().filter((u) => u.quizId === data.quizId);
  if (registered.length === 0) return;

  const lines = data.results.map(
    (r, i) => `${i + 1}. ${r.name} — ${r.correct}/${r.total} правильных`
  );
  const text = ["🏆 Квиз окончен! Результаты:", "", ...lines].join("\n");

  for (const user of registered) {
    try {
      await bot.api.sendMessage(user.chatId, text);
    } catch (err) {
      console.error(`Failed to send results to ${user.chatId}:`, err);
    }
    deleteState(user.chatId);
  }
}

async function onRemind(
  bot: Bot,
  data: { quizId: number; teams: Array<{ teamId: number; telegramChatId: number | null }> }
) {
  let kb: InlineKeyboard | undefined;
  let currentQuestionId: number | null = null;
  try {
    const gameState = await api.getGameState(data.quizId);
    currentQuestionId = gameState.currentQuestionId;
    const opts = gameState.question?.options || [];
    if (opts.length >= 2 && opts.length <= 8) {
      kb = new InlineKeyboard();
      const letters = LABELS.slice(0, opts.length);
      for (let i = 0; i < letters.length; i += 2) {
        kb.text(letters[i], `answer:${letters[i]}`);
        if (letters[i + 1]) kb.text(letters[i + 1], `answer:${letters[i + 1]}`);
        if (i + 2 < letters.length) kb.row();
      }
    }
  } catch {
    // no buttons if API fails
  }

  for (const team of data.teams) {
    if (!team.telegramChatId) continue;
    // Set awaiting_answer so button clicks work
    if (currentQuestionId) {
      const st = getState(team.telegramChatId);
      if ((st.step === "registered" || st.step === "awaiting_answer") && "teamId" in st) {
        setState(team.telegramChatId, {
          step: "awaiting_answer",
          quizId: data.quizId,
          teamId: st.teamId,
          questionId: currentQuestionId,
        });
      }
    }
    try {
      await bot.api.sendMessage(team.telegramChatId, "⏰ Ведущий напоминает: сдай ответ!", {
        ...(kb && { reply_markup: kb }),
      });
    } catch (err) {
      console.error(`Failed to send remind to ${team.telegramChatId}:`, err);
    }
  }
}
