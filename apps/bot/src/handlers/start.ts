import { Bot, InlineKeyboard } from "grammy";
import { deleteState, clearAllState, setState } from "../state.js";
import { api, Quiz } from "../api-client.js";

export function registerStartHandlers(bot: Bot) {
  /** Сбросить состояние всех капитанов (для ведущего). */
  bot.command("reset", async (ctx) => {
    try {
      clearAllState();
      await ctx.reply("Состояние всех капитанов сброшено. Каждый может заново ввести /start и зарегистрировать команду.");
    } catch (err) {
      console.error("Reset command error:", err);
      await ctx.reply("Ошибка сброса.").catch(() => {});
    }
  });

  bot.command("start", async (ctx) => {
    try {
      deleteState(ctx.chat.id);
      const chatId = ctx.chat.id;

      let quizzes: Quiz[];
      try {
        quizzes = await api.getActiveQuizzes();
      } catch {
        await ctx.reply("Ошибка соединения с сервером. Попробуй позже.");
        return;
      }

      if (quizzes.length === 0) {
        await ctx.reply("Привет! Сейчас нет активных квизов. Попробуй позже.");
        return;
      }

      if (quizzes.length === 1) {
        const quiz = quizzes[0];
        setState(chatId, { step: "awaiting_name", quizId: quiz.id });
        await ctx.reply(`Привет! Найден квиз «${quiz.title}». Введи название команды:`);
        return;
      }

      // Multiple active quizzes — show buttons
      const kb = new InlineKeyboard();
      for (const quiz of quizzes) {
        kb.text(quiz.title, `pick_quiz:${quiz.id}`).row();
      }
      await ctx.reply("Привет! Выбери квиз:", { reply_markup: kb });
    } catch (err) {
      console.error("Start command error:", err);
      try {
        await ctx.reply("Что-то пошло не так. Попробуй ещё раз.");
      } catch (_) {}
    }
  });
}
