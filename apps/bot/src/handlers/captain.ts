import { Bot, Context, InlineKeyboard } from "grammy";
import { api } from "../api-client.js";
import { getState, setState } from "../state.js";

const ANSWER_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export function registerCaptainHandlers(bot: Bot) {
  // Pick quiz from list of multiple
  bot.callbackQuery(/^pick_quiz:/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const quizId = Number(ctx.callbackQuery.data.split(":")[1]);
    const chatId = ctx.chat!.id;

    setState(chatId, { step: "awaiting_name", quizId });
    await ctx.reply("Введи название команды:");
  });

  // Нажатие кнопки ответа A/B/C/D
  bot.callbackQuery(/^answer:(A|B|C|D|E|F|G|H)$/, async (ctx) => {
    const letter = ctx.callbackQuery.data.split(":")[1];
    const chatId = ctx.chat!.id;
    const state = getState(chatId);

    // If registered but not awaiting_answer, try to get current question from API
    if (state.step === "registered" && "quizId" in state && "teamId" in state) {
      try {
        const gameState = await api.getGameState(state.quizId);
        if (gameState.status === "playing" && gameState.currentQuestionId) {
          setState(chatId, {
            step: "awaiting_answer",
            quizId: state.quizId,
            teamId: state.teamId,
            questionId: gameState.currentQuestionId,
          });
        }
      } catch {
        await ctx.answerCallbackQuery({ text: "Вопрос уже закрыт или ожидай следующий." });
        return;
      }
    }

    const updated = getState(chatId);
    if (updated.step !== "awaiting_answer") {
      await ctx.answerCallbackQuery({ text: "Вопрос уже закрыт или ожидай следующий." });
      return;
    }

    try {
      await api.submitAnswer(updated.questionId, updated.teamId, letter);
      setState(chatId, {
        step: "registered",
        quizId: updated.quizId,
        teamId: updated.teamId,
      });
      await ctx.answerCallbackQuery({ text: `Ответ ${letter} принят ✅` });
      await ctx.reply(`Ответ принят: ${letter} ✅`);
    } catch (err: any) {
      if (err.status === 409) {
        setState(chatId, { step: "registered", quizId: updated.quizId, teamId: updated.teamId });
        await ctx.answerCallbackQuery({ text: "Ты уже ответил ✅" });
      } else {
        await ctx.answerCallbackQuery({ show_alert: true, text: "Не удалось отправить ответ." }).catch(() => {});
      }
    }
  });

  // Text messages: handle team name input and answer submission
  bot.on("message:text", async (ctx) => {
    try {
      await handleTextMessage(ctx);
    } catch (err) {
      console.error("Text handler error:", err);
      await ctx.reply("Ошибка. Попробуй /start.").catch(() => {});
    }
  });
}

async function handleTextMessage(ctx: Context) {
  const chatId = ctx.chat!.id;
  const text = (ctx.message?.text || "").trim();
  const state = getState(chatId);

  // --- Team name registration ---
  if (state.step === "awaiting_name") {
      if (!text || text.length > 50) {
        await ctx.reply("Название должно быть от 1 до 50 символов. Попробуй ещё:");
        return;
      }

      try {
        const team = await api.registerTeam(state.quizId, text, chatId);
        setState(chatId, {
          step: "registered",
          quizId: state.quizId,
          teamId: team.id,
        });
        await ctx.reply(`Команда «${text}» зарегистрирована! ✅ Жди начала квиза.`);
      } catch (err: any) {
        await ctx.reply("Ошибка регистрации. Попробуй ещё раз:");
        console.error("Team registration error:", err);
      }
    return;
  }

  // --- Answer submission ---
  if (state.step === "awaiting_answer") {
      const letter = text.toUpperCase();
      if (!ANSWER_LABELS.includes(letter)) {
        await ctx.reply("Отправь букву: A, B, C или D");
        return;
      }

      try {
        await api.submitAnswer(state.questionId, state.teamId, letter);
        setState(chatId, {
          step: "registered",
          quizId: state.quizId,
          teamId: state.teamId,
        });
        await ctx.reply(`Ответ принят: ${letter} ✅`);
      } catch (err: any) {
        if (err.status === 409) {
          await ctx.reply("Ты уже ответил на этот вопрос ✅");
          setState(chatId, {
            step: "registered",
            quizId: state.quizId,
            teamId: state.teamId,
          });
        } else {
          await ctx.reply("Ошибка отправки ответа. Попробуй ещё раз.");
          console.error("Answer submit error:", err);
        }
      }
    return;
  }

  // Зарегистрирован: если прислал букву ответа — пробуем сдать по текущему состоянию игры
    // (на случай если бот не получил slide_changed или капитан зарегался после показа вопроса)
  if (state.step === "registered" && "teamId" in state && "quizId" in state) {
      const letter = text.toUpperCase();
      if (text.length === 1 && ANSWER_LABELS.includes(letter)) {
        let gameState;
        try {
          gameState = await api.getGameState(state.quizId);
        } catch {
          await ctx.reply("Квиз ещё не начался или ожидай следующий вопрос.");
          return;
        }
        const canAnswer =
          gameState.status === "playing" &&
          gameState.currentQuestionId != null &&
          (gameState.currentSlide === "question" || gameState.currentSlide === "timer");
        if (!canAnswer) {
          await ctx.reply("Сейчас приём ответов закрыт. Ожидай следующий вопрос.");
          return;
        }
        try {
          await api.submitAnswer(gameState.currentQuestionId!, state.teamId, letter);
          await ctx.reply(`Ответ принят: ${letter} ✅`);
        } catch (err: any) {
          if (err.status === 409) {
            await ctx.reply("Ты уже ответил на этот вопрос ✅");
          } else {
            await ctx.reply("Не удалось принять ответ. Попробуй ещё раз.");
            console.error("Answer submit error:", err);
          }
        }
        return;
      }
      await ctx.reply("Квиз ещё не начался или ожидай следующий вопрос.");
    return;
  }

  // idle — подсказать /start
  await ctx.reply("Отправь /start, чтобы начать.");
}
