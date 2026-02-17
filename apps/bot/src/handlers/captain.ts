import { Bot, InlineKeyboard } from "grammy";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { games, teams } from "../db/schema.js";
import { userStates, getState } from "../state.js";

export function registerCaptainHandlers(bot: Bot) {
  bot.callbackQuery("role:captain", async (ctx) => {
    await ctx.answerCallbackQuery();

    userStates.set(ctx.chat!.id, { step: "awaiting_join_code" });
    await ctx.reply("Введи 6-символьный код игры:");
  });

  bot.on("message:text", async (ctx) => {
    const chatId = ctx.chat.id;
    const state = getState(chatId);

    if (state.step !== "awaiting_join_code") return;

    const code = ctx.message.text.trim().toUpperCase();

    const game = await db.query.games.findFirst({
      where: eq(games.joinCode, code),
    });

    if (!game) {
      await ctx.reply("Игра с таким кодом не найдена. Попробуй ещё раз:");
      return;
    }

    userStates.delete(chatId);

    const existingTeams = await db.query.teams.findMany({
      where: eq(teams.gameId, game.id),
    });
    const takenNumbers = new Set(existingTeams.map((t) => t.teamNumber));

    const kb = new InlineKeyboard();
    for (let i = 1; i <= 5; i++) {
      const label = takenNumbers.has(i) ? `❌ Команда ${i} (занята)` : `Команда ${i}`;
      kb.text(label, `join_team:${game.id}:${i}`);
      if (i < 5) kb.row();
    }

    await ctx.reply("Выбери команду:", { reply_markup: kb });
  });

  bot.callbackQuery(/^join_team:/, async (ctx) => {
    await ctx.answerCallbackQuery();

    const parts = ctx.callbackQuery.data.split(":");
    const gameId = Number(parts[1]);
    const teamNumber = Number(parts[2]);
    const chatId = ctx.chat!.id;

    const existing = await db.query.teams.findFirst({
      where: and(eq(teams.gameId, gameId), eq(teams.teamNumber, teamNumber)),
    });

    if (existing) {
      await ctx.reply(`Команда ${teamNumber} уже занята. Выбери другую.`);
      return;
    }

    await db.insert(teams).values({
      gameId,
      teamNumber,
      captainChatId: chatId,
    });

    await ctx.reply(`Ты присоединился к команде ${teamNumber}! Ожидай начала игры.`);
  });
}
