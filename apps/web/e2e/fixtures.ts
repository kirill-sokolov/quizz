import { APIRequestContext } from "@playwright/test";

const API_URL = "http://localhost:3000";

/** Авторизуется как admin (устанавливает cookie в контексте request). */
export async function login(request: APIRequestContext): Promise<void> {
  const resp = await request.post(`${API_URL}/api/auth/login`, {
    data: { username: "admin", password: "admin" },
  });
  if (!resp.ok()) {
    throw new Error(`login failed: ${resp.status()} ${await resp.text()}`);
  }
}

export interface TestQuiz {
  id: number;
  joinCode: string;
  title: string;
}

/**
 * Создаёт квиз с одним choice-вопросом через API.
 * Предполагает, что request уже авторизован (вызван login()).
 */
export async function createTestQuiz(
  request: APIRequestContext,
  title = "E2E Test Quiz"
): Promise<TestQuiz> {
  const quizResp = await request.post(`${API_URL}/api/quizzes`, {
    data: { title },
  });
  if (!quizResp.ok()) {
    throw new Error(
      `createTestQuiz failed: ${quizResp.status()} ${await quizResp.text()}`
    );
  }
  const quiz = await quizResp.json();

  const qResp = await request.post(
    `${API_URL}/api/quizzes/${quiz.id}/questions`,
    {
      data: {
        text: "Тестовый вопрос?",
        options: ["Вариант A", "Вариант B", "Вариант C", "Вариант D"],
        correctAnswer: "A",
        timeLimitSec: 30,
      },
    }
  );
  if (!qResp.ok()) {
    throw new Error(
      `createQuestion failed: ${qResp.status()} ${await qResp.text()}`
    );
  }

  return quiz as TestQuiz;
}

/**
 * Запускает игру (game/start) и возвращает game state.
 * Предполагает, что request уже авторизован.
 */
export async function startGame(
  request: APIRequestContext,
  quizId: number
): Promise<unknown> {
  const resp = await request.post(`${API_URL}/api/game/start`, {
    data: { quizId },
  });
  if (!resp.ok()) {
    throw new Error(`startGame failed: ${resp.status()} ${await resp.text()}`);
  }
  return resp.json();
}

/** Удаляет квиз после теста (cleanup). */
export async function deleteQuiz(
  request: APIRequestContext,
  quizId: number
): Promise<void> {
  await request.delete(`${API_URL}/api/quizzes/${quizId}`);
}
