import { Bot, InlineKeyboard } from "grammy";
import { deleteState, clearAllState } from "../state.js";

export function registerStartHandlers(bot: Bot) {
  /** Сбросить состояние всех капитанов (для ведущего). */
  bot.command("reset", async (ctx) => {
    try {
      clearAllState();
      await ctx.reply("Состояние всех капитанов сброшено. Каждый может заново нажать «Я капитан» и ввести название команды.");
    } catch (err) {
      console.error("Reset command error:", err);
      await ctx.reply("Ошибка сброса.").catch(() => {});
    }
  });

  bot.command("start", async (ctx) => {
    try {
      deleteState(ctx.chat.id);

      const kb = new InlineKeyboard().text("🧑‍✈️ Я капитан", "role:captain");

      await ctx.reply(
        ["Привет! Я бот для свадебного квиза.", "", "Выбери роль:"].join("\n"),
        { reply_markup: kb }
      );
    } catch (err) {
      console.error("Start command error:", err);
      try {
        await ctx.reply("Что-то пошло не так. Попробуй ещё раз.");
      } catch (_) {}
    }
  });
}
