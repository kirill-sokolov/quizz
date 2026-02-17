import "dotenv/config";
import { Bot, InlineKeyboard } from "grammy";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN is missing. Put it in root .env");
}

const bot = new Bot(token);

bot.command("start", async (ctx) => {
  const kb = new InlineKeyboard()
    .text("🎤 Я ведущий", "role:admin")
    .text("🧑‍✈️ Я капитан", "role:captain");

  await ctx.reply(
    [
      "Привет! Я бот для свадебного квиза.",
      "",
      "Выбери роль:"
    ].join("\n"),
    { reply_markup: kb }
  );
});

bot.callbackQuery(/^role:/, async (ctx) => {
  const role = ctx.callbackQuery.data.split(":")[1];

  if (role === "admin") {
    await ctx.answerCallbackQuery();
    await ctx.reply("Ок, ты ведущий. Дальше добавим создание игры и управление вопросами.");
    return;
  }

  if (role === "captain") {
    await ctx.answerCallbackQuery();
    await ctx.reply("Ок, ты капитан. Дальше добавим вход по коду игры и ответы на вопросы.");
    return;
  }

  await ctx.answerCallbackQuery({ text: "Неизвестная роль" });
});

bot.catch((err) => {
  console.error("Bot error:", err.error);
});

console.log("Wedding bot is starting (long polling)...");
await bot.start();