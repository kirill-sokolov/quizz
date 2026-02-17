import { Bot, InlineKeyboard } from "grammy";
import { customAlphabet } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { games, teams } from "../db/schema.js";

const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export function registerAdminHandlers(bot: Bot) {
  bot.callbackQuery("role:admin", async (ctx) => {
    await ctx.answerCallbackQuery();

    const kb = new InlineKeyboard()
      .text("🎲 Создать игру", "action:create_game");

    await ctx.reply("Ок, ты ведущий!", { reply_markup: kb });
  });

  bot.callbackQuery("action:create_game", async (ctx) => {
    await ctx.answerCallbackQuery();

    const chatId = ctx.chat!.id;
    const joinCode = nanoid();

    await db.insert(games).values({
      joinCode,
      adminChatId: chatId,
    });

    const kb = new InlineKeyboard()
      .text("📋 Список команд", `action:list_teams:${joinCode}`);

    await ctx.reply(
      [
        `Игра создана!`,
        ``,
        `Код для подключения: <b>${joinCode}</b>`,
        ``,
        `Отправь этот код капитанам команд.`,
      ].join("\n"),
      { parse_mode: "HTML", reply_markup: kb }
    );
  });

  bot.callbackQuery(/^action:list_teams:/, async (ctx) => {
    await ctx.answerCallbackQuery();

    const joinCode = ctx.callbackQuery.data.split(":")[2];

    const game = await db.query.games.findFirst({
      where: eq(games.joinCode, joinCode),
    });

    if (!game) {
      await ctx.reply("Игра не найдена.");
      return;
    }

    const gameTeams = await db.query.teams.findMany({
      where: eq(teams.gameId, game.id),
    });

    if (gameTeams.length === 0) {
      const kb = new InlineKeyboard()
        .text("🔄 Обновить", `action:list_teams:${joinCode}`);
      await ctx.reply("Пока ни одна команда не подключилась.", { reply_markup: kb });
      return;
    }

    const lines = gameTeams
      .sort((a, b) => a.teamNumber - b.teamNumber)
      .map((t) => `  Команда ${t.teamNumber} — капитан ${t.captainChatId}`);

    const kb = new InlineKeyboard()
      .text("🔄 Обновить", `action:list_teams:${joinCode}`);

    await ctx.reply(
      [`Подключившиеся команды:`, ...lines].join("\n"),
      { reply_markup: kb }
    );
  });
}
