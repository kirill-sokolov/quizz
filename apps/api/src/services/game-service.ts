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
import type { SlideType } from "../types/slide.js";

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
        registrationOpen: false,
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
        registrationOpen: false,
      })
      .returning();
  }

  broadcast("game_lobby", { quizId, joinCode });

  return { ...state, joinCode };
}

export async function openRegistration(quizId: number) {
  const [state] = await db
    .select()
    .from(gameState)
    .where(eq(gameState.quizId, quizId));
  if (!state || state.status !== "lobby") {
    throw new Error("Game is not in lobby state");
  }

  const [updated] = await db
    .update(gameState)
    .set({ registrationOpen: true })
    .where(eq(gameState.quizId, quizId))
    .returning();

  broadcast("registration_opened", { quizId });

  return updated;
}

export async function beginGame(quizId: number) {
  const [state] = await db
    .select()
    .from(gameState)
    .where(eq(gameState.quizId, quizId));
  if (!state || state.status !== "lobby") {
    throw new Error("Game is not in lobby state");
  }

  // Switch to "playing" and load first question
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
  slide: SlideType
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

export async function getTeamDetails(quizId: number, teamId: number) {
  const allQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quizId))
    .orderBy(asc(questions.orderNum));

  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId));

  if (!team) {
    throw new Error("Team not found");
  }

  const teamAnswers = await db
    .select()
    .from(answers)
    .where(eq(answers.teamId, teamId));

  const answersByQuestion = new Map(
    teamAnswers.map((a) => [a.questionId, a.answerText])
  );

  const details = allQuestions.map((q) => {
    const teamAnswer = answersByQuestion.get(q.id) || null;
    const isCorrect = teamAnswer === q.correctAnswer;

    // Получить текст варианта по букве
    const getAnswerText = (letter: string | null) => {
      if (!letter) return null;
      const index = letter.charCodeAt(0) - 'A'.charCodeAt(0);
      return q.options[index] || letter;
    };

    const teamAnswerText = getAnswerText(teamAnswer);
    const correctAnswerText = getAnswerText(q.correctAnswer);

    return {
      questionId: q.id,
      questionText: q.text,
      options: q.options,
      teamAnswer,
      teamAnswerText,
      correctAnswer: q.correctAnswer,
      correctAnswerText,
      isCorrect,
    };
  });

  const totalCorrect = details.filter((d) => d.isCorrect).length;
  const totalQuestions = allQuestions.length;

  return {
    teamId: team.id,
    teamName: team.name,
    totalCorrect,
    totalQuestions,
    details,
  };
}

export async function getResults(quizId: number) {
  const allQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quizId));

  const allTeams = await db
    .select()
    .from(teams)
    .where(and(eq(teams.quizId, quizId), eq(teams.isKicked, false)));

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

  const results = allTeams
    .map((t) => ({
      teamId: t.id,
      name: t.name,
      ...answersByTeam.get(t.id)!,
    }))
    .sort((a, b) => b.correct - a.correct || b.total - a.total);

  return results;
}

export async function archiveQuiz(quizId: number) {
  await db
    .update(quizzes)
    .set({ status: "archived" })
    .where(eq(quizzes.id, quizId));

  broadcast("quiz_archived", { quizId });

  return { success: true };
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

  const results = await getResults(quizId);

  broadcast("quiz_finished", { quizId, results });

  return results;
}
