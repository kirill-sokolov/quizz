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
import { evaluateTextAnswers } from "./llm/evaluate-text-answer.js";

export function generateJoinCode(): string {
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
        resultsRevealCount: 0,
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
        resultsRevealCount: 0,
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

    // Only use video_warning if it has actual content
    const hasVideoWarning = questionSlides.some(s =>
      s.type === "video_warning" && (s.imageUrl || s.videoUrl)
    );
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
      resultsRevealCount: 0,
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

export async function restartQuiz(quizId: number) {
  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId));
  if (!quiz) throw new Error("Quiz not found");
  if (quiz.status === "draft") {
    throw new Error("Quiz is already a draft");
  }

  const newJoinCode = generateJoinCode();

  // Reset quiz status to draft with new join code
  await db
    .update(quizzes)
    .set({ status: "draft", joinCode: newJoinCode })
    .where(eq(quizzes.id, quizId));

  // Delete all answers for this quiz's questions
  const quizQuestions = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.quizId, quizId));
  for (const q of quizQuestions) {
    await db.delete(answers).where(eq(answers.questionId, q.id));
  }

  // Delete all teams
  await db.delete(teams).where(eq(teams.quizId, quizId));

  // Delete game state
  await db.delete(gameState).where(eq(gameState.quizId, quizId));

  return { success: true };
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

  // Only use video_warning if it has actual content
  const hasVideoWarning = questionSlides.some(s =>
    s.type === "video_warning" && (s.imageUrl || s.videoUrl)
  );
  if (hasVideoWarning) {
    startingSlide = "video_warning";
  }

  const [updated] = await db
    .update(gameState)
    .set({
      currentQuestionId: nextQ.id,
      currentSlide: startingSlide,
      timerStartedAt: null,
      resultsRevealCount: 0,
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
  const patch: { currentSlide: SlideType; timerStartedAt: Date | null; resultsRevealCount?: number } = {
    currentSlide: slide,
    timerStartedAt: slide === "timer" ? new Date() : null,
  };

  if (slide !== "results") {
    patch.resultsRevealCount = 0;
  }

  const [updated] = await db
    .update(gameState)
    .set(patch)
    .where(eq(gameState.quizId, quizId))
    .returning();

  // When switching to answer slide for text questions — trigger LLM evaluation
  if (slide === "answer" && updated.currentQuestionId) {
    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, updated.currentQuestionId));

    if (question?.questionType === "text") {
      const questionAnswers = await db
        .select()
        .from(answers)
        .where(eq(answers.questionId, question.id));

      // Only evaluate answers that haven't been scored yet
      const unscored = questionAnswers.filter((a) => a.awardedScore === null);
      if (unscored.length > 0) {
        const correctAnswers = question.correctAnswer
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        const results = await evaluateTextAnswers(
          correctAnswers,
          unscored.map((a) => ({ teamId: a.teamId, answerText: a.answerText })),
          question.weight
        );

        for (const r of results) {
          const answer = unscored.find((a) => a.teamId === r.teamId);
          if (answer) {
            await db
              .update(answers)
              .set({ awardedScore: r.score })
              .where(eq(answers.id, answer.id));
          }
        }
      }
    }
  }

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
    teamAnswers.map((a) => [a.questionId, { answerText: a.answerText, awardedScore: a.awardedScore }])
  );

  const details = allQuestions.map((q) => {
    const teamAnswerData = answersByQuestion.get(q.id) || null;
    const teamAnswer = teamAnswerData?.answerText || null;

    if (q.questionType === "text") {
      return {
        questionId: q.id,
        questionText: q.text,
        questionType: q.questionType as "text",
        weight: q.weight,
        options: q.options,
        teamAnswer,
        teamAnswerText: teamAnswer,
        correctAnswer: q.correctAnswer,
        correctAnswerText: q.correctAnswer,
        awardedScore: teamAnswerData?.awardedScore ?? null,
        isCorrect: (teamAnswerData?.awardedScore ?? 0) >= q.weight,
      };
    }

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
      questionType: q.questionType as "choice",
      weight: q.weight,
      options: q.options,
      teamAnswer,
      teamAnswerText,
      correctAnswer: q.correctAnswer,
      correctAnswerText,
      awardedScore: null as number | null,
      isCorrect,
    };
  });

  let totalScore = 0;
  for (const d of details) {
    if (d.questionType === "text") {
      totalScore += d.awardedScore ?? 0;
    } else {
      totalScore += d.isCorrect ? 1 : 0;
    }
  }
  const totalQuestions = allQuestions.length;

  return {
    teamId: team.id,
    teamName: team.name,
    totalCorrect: totalScore,
    totalQuestions,
    details,
  };
}

export async function getResults(quizId: number, revealCount?: number) {
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
      if (q.questionType === "text") {
        stats.correct += a.awardedScore ?? 0;
      } else {
        if (a.answerText === q.correctAnswer) {
          stats.correct++;
        }
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

  if (typeof revealCount === "number") {
    return results.slice(0, Math.max(0, revealCount));
  }

  return results;
}


export async function revealNextResult(quizId: number) {
  const [state] = await db
    .select()
    .from(gameState)
    .where(eq(gameState.quizId, quizId));

  if (!state || state.status !== "finished") {
    throw new Error("Game is not finished");
  }

  const fullResults = await getResults(quizId);
  const nextCount = Math.min(fullResults.length, (state.resultsRevealCount ?? 0) + 1);

  const [updated] = await db
    .update(gameState)
    .set({ currentSlide: "results", resultsRevealCount: nextCount })
    .where(eq(gameState.quizId, quizId))
    .returning();

  broadcast("results_revealed", {
    quizId,
    resultsRevealCount: nextCount,
    results: fullResults,
  });

  return {
    state: updated,
    results: fullResults,
    fullResultsCount: fullResults.length,
  };
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
    .set({ status: "finished", currentSlide: "results", resultsRevealCount: 0 })
    .where(eq(gameState.quizId, quizId));

  const results = await getResults(quizId);

  broadcast("quiz_finished", { quizId, results, resultsRevealCount: 0 });

  return results;
}
