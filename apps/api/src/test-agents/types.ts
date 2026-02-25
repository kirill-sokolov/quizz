/**
 * Тестовые агенты (боты) для симуляции команд
 * Модуль изолирован для лёгкого удаления
 */

export interface Bot {
  id: number;
  teamId: number;
  name: string;
  quizId: number;
}

export interface BotConfig {
  count: number;       // количество ботов (1-20)
  answerDelay: number; // задержка ответа в мс (всегда 1000)
}
