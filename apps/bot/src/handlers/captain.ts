import { Bot, InlineKeyboard } from "grammy";
import { api, Quiz } from "../api-client.js";
import { getState, setState } from "../state.js";

const ANSWER_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export function registerCaptainHandlers(bot: Bot) {
  // "Я капитан" button → look for active quizzes
  bot.callbackQuery("role:captain", async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = ctx.chat!.id;

    let quizzes: Quiz[];
    try {
      quizzes = await api.getActiveQuizzes();
    } catch {
      await ctx.reply("Ошибка соединения с сервером. Попробуй позже.");
      return;
    }

    if (quizzes.length === 0) {
      await ctx.reply("Сейчас нет активных квизов. Попробуй позже.");
      return;
    }

    if (quizzes.length === 1) {
      const quiz = quizzes[0];
      setState(chatId, { step: "awaiting_name", quizId: quiz.id });
      await ctx.reply(`Найден квиз «${quiz.title}». Введи название команды:`);
      return;
    }

    // Multiple active quizzes — show buttons
    const kb = new InlineKeyboard();
    for (const quiz of quizzes) {
      kb.text(quiz.title, `pick_quiz:${quiz.id}`).row();
    }
    await ctx.reply("Выбери квиз:", { reply_markup: kb });
  });

  // Pick quiz from list of multiple
  bot.callbackQuery(/^pick_quiz:/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const quizId = Number(ctx.callbackQuery.data.split(":")[1]);
    const chatId = ctx.chat!.id;

    setState(chatId, { step: "awaiting_name", quizId });
    await ctx.reply("Введи название команды:");
  });

  // Text messages: handle team name input and answer submission
  bot.on("message:text", async (ctx) => {
    const chatId = ctx.chat.id;
    const state = getState(chatId);
    const text = ctx.message.text.trim();

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
        await ctx.reply("Ответ принят ✅");
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

    // If registered but not awaiting answer, ignore or inform
    if (state.step === "registered") {
      await ctx.reply("Квиз ещё не начался или ожидай следующий вопрос.");
      return;
    }
  });
}
