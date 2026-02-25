/**
 * Генератор случайных ответов для тестовых ботов
 */

export class BotAnswerGenerator {
  /**
   * Генерирует случайный ответ в зависимости от типа вопроса
   */
  static generate(question: any): string {
    if (question.questionType === "choice") {
      // Для multiple choice: случайный выбор A/B/C/D
      const choices = ["A", "B", "C", "D"];
      return choices[Math.floor(Math.random() * choices.length)];
    } else {
      // Для текстовых ответов: 50% правильного ответа
      const correct = question.correctAnswer || "";
      const halfLength = Math.ceil(correct.length / 2);
      return correct.substring(0, halfLength);
    }
  }
}
