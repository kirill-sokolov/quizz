import { config } from "./config.js";

const base = config.API_URL;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`API ${res.status}: ${body}`) as Error & {
      status: number;
    };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

export interface Quiz {
  id: number;
  title: string;
  status: string;
  joinCode: string | null;
}

export interface Team {
  id: number;
  quizId: number;
  name: string;
  telegramChatId: bigint | null;
  isKicked: boolean;
}

export interface GameStateResponse {
  id: number;
  quizId: number;
  currentQuestionId: number | null;
  currentSlide: "question" | "timer" | "answer";
  timerStartedAt: string | null;
  status: "lobby" | "playing" | "finished";
  question: {
    id: number;
    text: string;
    options: string[];
    correctAnswer: string;
    timeLimitSec: number;
  } | null;
}

export interface Answer {
  id: number;
  questionId: number;
  teamId: number;
  answerText: string;
}

export const api = {
  getActiveQuizzes(): Promise<Quiz[]> {
    return request<Quiz[]>("/api/quizzes/active");
  },

  getQuizByCode(code: string): Promise<Quiz> {
    return request<Quiz>(`/api/quizzes/by-code/${code}`);
  },

  registerTeam(
    quizId: number,
    name: string,
    telegramChatId: number
  ): Promise<Team> {
    return request<Team>(`/api/quizzes/${quizId}/teams`, {
      method: "POST",
      body: JSON.stringify({ name, telegramChatId }),
    });
  },

  submitAnswer(
    questionId: number,
    teamId: number,
    answerText: string
  ): Promise<Answer> {
    return request<Answer>("/api/answers", {
      method: "POST",
      body: JSON.stringify({ questionId, teamId, answerText }),
    });
  },

  getGameState(quizId: number): Promise<GameStateResponse> {
    return request<GameStateResponse>(`/api/game/state/${quizId}`);
  },
};
