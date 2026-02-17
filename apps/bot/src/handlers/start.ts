import { Bot, InlineKeyboard } from "grammy";
import { userStates } from "../state.js";

export function registerStartHandlers(bot: Bot) {
  bot.command("start", async (ctx) => {
    userStates.delete(ctx.chat.id);

    const kb = new InlineKeyboard()
      .text("🎤 Я ведущий", "role:admin")
      .text("🧑‍✈️ Я капитан", "role:captain");

    await ctx.reply(
      ["Привет! Я бот для свадебного квиза.", "", "Выбери роль:"].join("\n"),
      { reply_markup: kb }
    );
  });
}
