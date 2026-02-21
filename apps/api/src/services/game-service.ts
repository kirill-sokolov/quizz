import { db } from "../db/index.js";
import {
  quizzes,
  questions,
  answers,
  teams,
  gameState,
  slides,
} from "../db/schema.js";
import { eq, and, asc } from "drizzle-orm";
import { broadcast } from "../ws/index.js";

function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function startGame(quizId: number) {
  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId));

  const joinCode = quiz?.joinCode || generateJoinCode();

  await db
    .update(quizzes)
    .set({ status: "active", joinCode })
    .where(eq(quizzes.id, quizId));

  const [existing] = await db
    .select()
    .from(gameState)
    .where(eq(gameState.quizId, quizId));

  let state;
  if (existing) {
    [state] = await db
      .update(gameState)
      .set({
        status: "lobby",
        currentQuestionId: null,
        currentSlide: "question",
        timerStartedAt: null,
      })
      .where(eq(gameState.quizId, quizId))
      .returning();
  } else {
    [state] = await db
      .insert(gameState)
      .values({
        quizId,
        status: "lobby",
        currentQuestionId: null,
        currentSlide: "question",
      })
      .returning();
  }

  broadcast("game_lobby", { quizId, joinCode });

  return { ...state, joinCode };
}

export async function beginGame(quizId: number) {
  const [state] = await db
    .select()
    .from(gameState)
    .where(eq(gameState.quizId, quizId));
  if (!state || state.status !== "lobby") {
    throw new Error("Game is not in lobby state");
  }

  const firstQuestion = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quizId))
    .orderBy(asc(questions.orderNum))
    .limit(1);

  const currentQuestionId = firstQuestion[0]?.id ?? null;

  // Check if the first question has video slides to determine the starting slide
  let startingSlide: "video_warning" | "question" = "question";
  if (currentQuestionId) {
    const questionSlides = await db
      .select()
      .from(slides)
      .where(eq(slides.questionId, currentQuestionId));

    const hasVideoWarning = questionSlides.some(s => s.type === "video_warning");
    if (hasVideoWarning) {
      startingSlide = "video_warning";
    }
  }

  const [updated] = await db
    .update(gameState)
    .set({
      status: "playing",
      currentQuestionId,
      currentSlide: startingSlide,
      timerStartedAt: null,
    })
    .where(eq(gameState.quizId, quizId))
    .returning();

  broadcast("slide_changed", {
    quizId,
    questionId: currentQuestionId,
    slide: startingSlide,
  });

  return updated;
}

export async function resetToFirstQuestion(quizId: number) {
  const [state] = await db
    .select()
    .from(gameState)
    .where(eq(gameState.quizId, quizId));
  if (!state || state.status !== "playing") {
    throw new Error("Game is not in playing state");
  }

  const firstQuestion = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quizId))
    .orderBy(asc(questions.orderNum))
    .limit(1);

  const currentQuestionId = firstQuestion[0]?.id ?? null;

  // Check if the first question has video slides to determine the starting slide
  let startingSlide: "video_warning" | "question" = "question";
  if (currentQuestionId) {
    const questionSlides = await db
      .select()
      .from(slides)
      .where(eq(slides.questionId, currentQuestionId));

    const hasVideoWarning = questionSlides.some(s => s.type === "video_warning");
    if (hasVideoWarning) {
      startingSlide = "video_warning";
    }
  }

  const [updated] = await db
    .update(gameState)
    .set({
      currentQuestionId,
      currentSlide: startingSlide,
      timerStartedAt: null,
    })
    .where(eq(gameState.quizId, quizId))
    .returning();

  // Clear all answers for a fresh start
  if (currentQuestionId) {
    await db
      .delete(answers)
      .where(eq(answers.questionId, currentQuestionId));
  }

  broadcast("slide_changed", {
    quizId,
    questionId: currentQuestionId,
    slide: startingSlide,
  });

  return updated;
}

export async function nextQuestion(quizId: number) {
  const [state] = await db
    .select()
    .from(gameState)
    .where(eq(gameState.quizId, quizId));
  if (!state) throw new Error("Game not started");

  const allQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quizId))
    .orderBy(asc(questions.orderNum));

  const currentIndex = allQuestions.findIndex(
    (q) => q.id === state.currentQuestionId
  );
  const nextQ = allQuestions[currentIndex + 1];

  if (!nextQ) {
    return null;
  }

  // Check if the next question has video slides to determine the starting slide
  let startingSlide: "video_warning" | "question" = "question";
  const questionSlides = await db
    .select()
    .from(slides)
    .where(eq(slides.questionId, nextQ.id));

  const hasVideoWarning = questionSlides.some(s => s.type === "video_warning");
  if (hasVideoWarning) {
    startingSlide = "video_warning";
  }

  const [updated] = await db
    .update(gameState)
    .set({
      currentQuestionId: nextQ.id,
      currentSlide: startingSlide,
      timerStartedAt: null,
    })
    .where(eq(gameState.quizId, quizId))
    .returning();

  broadcast("slide_changed", {
    quizId,
    questionId: nextQ.id,
    slide: startingSlide,
  });

  return updated;
}

export async function setSlide(
  quizId: number,
  slide: "video_warning" | "video_intro" | "question" | "timer" | "answer"
) {
  const [updated] = await db
    .update(gameState)
    .set({
      currentSlide: slide,
      timerStartedAt: slide === "timer" ? new Date() : null,
    })
    .where(eq(gameState.quizId, quizId))
    .returning();

  broadcast("slide_changed", {
    quizId,
    questionId: updated.currentQuestionId,
    slide,
  });

  return updated;
}

export async function getRemind(quizId: number, teamId?: number) {
  const [state] = await db
    .select()
    .from(gameState)
    .where(eq(gameState.quizId, quizId));
  if (!state?.currentQuestionId) return [];

  const allTeams = await db
    .select()
    .from(teams)
    .where(and(eq(teams.quizId, quizId), eq(teams.isKicked, false)));

  const submitted = await db
    .select({ teamId: answers.teamId })
    .from(answers)
    .where(eq(answers.questionId, state.currentQuestionId));
  const submittedIds = new Set(submitted.map((a) => a.teamId));

  let notSubmitted = allTeams.filter((t) => !submittedIds.has(t.id));

  if (teamId) {
    notSubmitted = notSubmitted.filter((t) => t.id === teamId);
  }

  return notSubmitted;
}

export async function finishGame(quizId: number) {
  await db
    .update(quizzes)
    .set({ status: "finished", joinCode: null })
    .where(eq(quizzes.id, quizId));

  await db
    .update(gameState)
    .set({ status: "finished" })
    .where(eq(gameState.quizId, quizId));

  const allQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quizId));

  const allTeams = await db
    .select()
    .from(teams)
    .where(and(eq(teams.quizId, quizId), eq(teams.isKicked, false)));

  const allAnswers = await db
    .select()
    .from(answers)
    .where(
      eq(
        answers.questionId,
        allQuestions.length > 0 ? allQuestions[0].id : -1
      )
    );

  // Gather all answers for all questions
  const answersByTeam = new Map<number, { correct: number; total: number; fastest: number | null }>();

  for (const team of allTeams) {
    answersByTeam.set(team.id, { correct: 0, total: 0, fastest: null });
  }

  for (const q of allQuestions) {
    const qAnswers = await db
      .select()
      .from(answers)
      .where(eq(answers.questionId, q.id));

    for (const a of qAnswers) {
      const stats = answersByTeam.get(a.teamId);
      if (!stats) continue;
      stats.total++;
      if (a.answerText === q.correctAnswer) {
        stats.correct++;
      }
    }
  }

  // Сортировка: сначала по убыванию правильных, при равенстве — по убыванию числа ответов
  const results = allTeams
    .map((t) => ({
      teamId: t.id,
      name: t.name,
      ...answersByTeam.get(t.id)!,
    }))
    .sort((a, b) => b.correct - a.correct || b.total - a.total);

  broadcast("quiz_finished", { quizId, results });

  return results;
}
