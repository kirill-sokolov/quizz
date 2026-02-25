/**
 * Сервис управления тестовыми ботами
 */

import { db } from "../db/index.js";
import { teams, answers } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { BotAnswerGenerator } from "./bot-answer.generator.js";
import type { Bot, BotConfig } from "./types.js";

export class BotAgentService {
  private activeBots: Map<number, Bot[]> = new Map();
  private wsServer: any; // WebSocket server instance

  constructor(wsServer: any) {
    this.wsServer = wsServer;
  }

  /**
   * Создаёт N ботов для квиза
   */
  async createBots(quizId: number, config: BotConfig): Promise<Bot[]> {
    const bots: Bot[] = [];

    for (let i = 1; i <= config.count; i++) {
      // Создаём команду-бота в БД
      const [team] = await db
        .insert(teams)
        .values({
          quizId,
          name: `🤖 Бот ${i}`,
          telegramChatId: null,
          isBot: true,
          isKicked: false,
        })
        .returning();

      bots.push({
        id: i,
        teamId: team.id,
        name: team.name,
        quizId,
      });
    }

    // Сохраняем в памяти для быстрого доступа
    this.activeBots.set(quizId, bots);

    console.log(`[BotAgent] Created ${bots.length} bots for quiz ${quizId}`);
    return bots;
  }

  /**
   * Удаляет всех ботов квиза
   */
  async removeBots(quizId: number): Promise<void> {
    await db
      .delete(teams)
      .where(and(eq(teams.quizId, quizId), eq(teams.isBot, true)));

    this.activeBots.delete(quizId);
    console.log(`[BotAgent] Removed all bots for quiz ${quizId}`);
  }

  /**
   * Обработка вопроса: боты отвечают через 1 секунду
   * Вызывается при WebSocket событии slide_changed (slide=timer)
   */
  async handleQuestion(quizId: number, question: any): Promise<void> {
    // Проверяем память
    let bots = this.activeBots.get(quizId);

    // Если в памяти нет ботов, загружаем из БД
    if (!bots || bots.length === 0) {
      const dbBots = await db
        .select()
        .from(teams)
        .where(and(eq(teams.quizId, quizId), eq(teams.isBot, true)));

      if (dbBots.length === 0) return;

      // Загружаем ботов в память
      bots = dbBots.map((team, idx) => ({
        id: idx + 1,
        teamId: team.id,
        name: team.name,
        quizId,
      }));

      this.activeBots.set(quizId, bots);
      console.log(`[BotAgent] Loaded ${bots.length} bots from DB for quiz ${quizId}`);
    }

    console.log(`[BotAgent] ${bots.length} bots answering question ${question.id}`);

    // Каждый бот отвечает через 1 секунду
    for (const bot of bots) {
      setTimeout(async () => {
        try {
          // Проверяем, не ответил ли бот уже на этот вопрос
          const existingAnswer = await db
            .select()
            .from(answers)
            .where(
              and(
                eq(answers.questionId, question.id),
                eq(answers.teamId, bot.teamId)
              )
            )
            .limit(1);

          if (existingAnswer.length > 0) {
            console.log(`[BotAgent] Bot ${bot.name} already answered question ${question.id}, skipping`);
            return;
          }

          const answer = BotAnswerGenerator.generate(question);

          // Сохраняем ответ в БД
          await db.insert(answers).values({
            questionId: question.id,
            teamId: bot.teamId,
            answerText: answer,
            submittedAt: new Date(),
          });

          // Отправляем WebSocket событие
          this.wsServer.broadcast("answer_submitted", {
            quizId,
            teamId: bot.teamId,
            teamName: bot.name,
          });

          console.log(`[BotAgent] Bot ${bot.name} answered: ${answer}`);
        } catch (err) {
          console.error(`[BotAgent] Error answering question:`, err);
        }
      }, 1000);
    }
  }

  /**
   * Автоудаление ботов при завершении квиза
   */
  async onQuizFinished(quizId: number): Promise<void> {
    await this.removeBots(quizId);
    console.log(`[BotAgent] Auto-removed bots after quiz ${quizId} finished`);
  }

  /**
   * Получить количество активных ботов для квиза
   */
  getBotCount(quizId: number): number {
    return this.activeBots.get(quizId)?.length || 0;
  }
}
