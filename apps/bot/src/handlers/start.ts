import { Bot, InlineKeyboard } from "grammy";
import { deleteState } from "../state.js";

export function registerStartHandlers(bot: Bot) {
  bot.command("start", async (ctx) => {
    deleteState(ctx.chat.id);

    const kb = new InlineKeyboard()
      .text("🧑‍✈️ Я капитан", "role:captain");

    await ctx.reply(
      ["Привет! Я бот для свадебного квиза.", "", "Выбери роль:"].join("\n"),
      { reply_markup: kb }
    );
  });
}
