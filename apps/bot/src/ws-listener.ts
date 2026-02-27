import WebSocket from "ws";
import { Bot, InlineKeyboard } from "grammy";
import { config } from "./config.js";
import { getAllRegistered, getRegisteredByTeamId, setState, deleteState, getState } from "./state.js";
import { api, type GameStateResponse } from "./api-client.js";

const LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

/** Track last known questionId per quiz to detect "first question" = game start */
const lastQuestionId = new Map<number, number>();

export function startWsListener(bot: Bot) {
  const wsUrl = config.API_URL.replace(/^http/, "ws") + "/ws";
  console.log("WS connecting to:", wsUrl);

  let current: WebSocket | null = null;

  function connect() {
    // Terminate any existing connection to prevent duplicates
    if (current) {
      current.removeAllListeners();
      current.terminate();
      current = null;
    }

    const ws = new WebSocket(wsUrl);
    current = ws;

    ws.on("open", () => {
      console.log("WS connected to API");
    });

    ws.on("message", async (raw) => {
      // Ignore messages from stale connections
      if (ws !== current) return;
      try {
        const msg = JSON.parse(raw.toString());
        await handleEvent(bot, msg.event, msg.data);
      } catch (err) {
        console.error("WS message error:", err);
      }
    });

    ws.on("close", () => {
      if (ws !== current) return;
      current = null;
      console.log("WS disconnected, reconnecting in 3s...");
      setTimeout(connect, 3000);
    });

    ws.on("error", (err) => {
      console.error("WS error:", err);
    });
  }

  connect();
}

export async function handleEvent(bot: Bot, event: string, data: any) {
  switch (event) {
    case "slide_changed":
      await onSlideChanged(bot, data);
      break;
    case "team_kicked":
      await onTeamKicked(bot, data);
      break;
    case "quiz_finished":
      await onQuizFinished(bot, data);
      break;
    case "remind":
      await onRemind(bot, data);
      break;
  }
}

async function onSlideChanged(bot: Bot, data: { quizId: number; questionId: number; slide: string }) {
  const registered = getAllRegistered().filter((u) => u.quizId === data.quizId);
  if (registered.length === 0) return;

  if (data.slide === "question" && data.questionId) {
    // On question slide bot should stay silent.
    // We only track current question id and wait for timer slide.
    lastQuestionId.set(data.quizId, data.questionId);
  } else if (data.slide === "timer") {
    // Fetch question data to build answer buttons
    let question;
    try {
      const gameState = await api.getGameState(data.quizId);
      question = gameState.question;
    } catch {
      return;
    }
    if (!question) return;

    const isTextQuestion = question.questionType === "text";
    const options = question.options || [];

    // Build inline keyboard with answer buttons (only for choice questions)
    const replyMarkup =
      !isTextQuestion && options.length >= 2 && options.length <= 8
        ? (() => {
            const kb = new InlineKeyboard();
            const letters = LABELS.slice(0, options.length);
            for (let i = 0; i < letters.length; i += 2) {
              kb.text(letters[i], `answer:${letters[i]}`);
              if (letters[i + 1]) kb.text(letters[i + 1], `answer:${letters[i + 1]}`);
              if (i + 2 < letters.length) kb.row();
            }
            return kb;
          })()
        : undefined;

    // Ensure awaiting_answer is set for users who may have missed the question slide
    if (data.questionId) {
      for (const user of registered) {
        const st = getState(user.chatId);
        if (st.step === "registered") {
          setState(user.chatId, {
            step: "awaiting_answer",
            quizId: user.quizId,
            teamId: user.teamId,
            questionId: data.questionId,
            questionType: question.questionType || "choice",
          });
        }
      }
    }

    const correctAnswerCount = (question.correctAnswer || "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean).length;
    const answerHint =
      correctAnswerCount > 1
        ? `✏️ Перечисли ${correctAnswerCount} ответа через запятую.`
        : "✏️ Напиши ответ текстом.";

    const timerText = isTextQuestion
      ? [
          "⏱ Время пошло!",
          "",
          "❓ Вопрос",
          "",
          question.text,
          "",
          answerHint,
        ].join("\n")
      : [
          "⏱ Время пошло!",
          "",
          "❓ Вопрос",
          "",
          question.text,
          "",
          options.map((opt: string, i: number) => `${LABELS[i]}) ${opt}`).join("\n"),
          "",
          "Выбери вариант кнопками ниже.",
        ].join("\n");

    // Send "timer started" message with buttons IMMEDIATELY
    for (const user of registered) {
      try {
        await bot.api.sendMessage(user.chatId, timerText, {
          ...(replyMarkup && { reply_markup: replyMarkup }),
        });
      } catch (err) {
        console.error(`Failed to send timer to ${user.chatId}:`, err);
      }
    }
  } else if (data.slide === "answer") {
    // Get correct answer and team answers
    let correctAnswer = "";
    let gameQuestion: GameStateResponse["question"] = null;
    let answers: Array<{ teamId: number; answerText: string; awardedScore?: number | null }> = [];
    try {
      const gameState = await api.getGameState(data.quizId);
      gameQuestion = gameState.question;
      correctAnswer = gameQuestion?.correctAnswer || "";
      if (data.questionId) {
        answers = await api.getAnswers(data.questionId);
      }
    } catch (err) {
      console.error("Failed to get answers:", err);
    }

    // Send result to each team and move back to registered
    for (const user of registered) {
      const st = getState(user.chatId);
      if (st.step === "awaiting_answer" || st.step === "registered") {
        setState(user.chatId, {
          step: "registered",
          quizId: user.quizId,
          teamId: user.teamId,
        });

        // Find team's answer
        const teamAnswer = answers.find((a) => a.teamId === user.teamId);
        if (teamAnswer) {
          const isTextQ = gameQuestion?.questionType === "text";
          let text: string;
          if (isTextQ) {
            const score = teamAnswer.awardedScore ?? 0;
            const weight = gameQuestion?.weight ?? 1;
            text = `Твой ответ: ${teamAnswer.answerText}\nОценка: ${score}/${weight}`;
          } else {
            const isCorrect = teamAnswer.answerText === correctAnswer;
            const icon = isCorrect ? "✅" : "❌";
            text = isCorrect
              ? `Твой ответ: ${teamAnswer.answerText} ${icon} Правильно!`
              : `Твой ответ: ${teamAnswer.answerText} ${icon} Неправильно. Правильный ответ: ${correctAnswer}`;
          }

          try {
            await bot.api.sendMessage(user.chatId, text);
          } catch (err) {
            console.error(`Failed to send result to ${user.chatId}:`, err);
          }
        }
      }
    }
  }
}

async function onTeamKicked(bot: Bot, data: { teamId: number; name: string }) {
  const chatId = getRegisteredByTeamId(data.teamId);
  if (!chatId) return;

  deleteState(chatId);
  try {
    await bot.api.sendMessage(chatId, "❌ Ты был исключён из игры.");
  } catch (err) {
    console.error(`Failed to notify kicked team ${data.teamId}:`, err);
  }
}

async function onQuizFinished(
  bot: Bot,
  data: { quizId: number; results: Array<{ teamId: number; name: string; correct: number; total: number; fastest: number | null }> }
) {
  const registered = getAllRegistered().filter((u) => u.quizId === data.quizId);
  if (registered.length === 0) return;

  // Clean up tracking state
  lastQuestionId.delete(data.quizId);

  // Overall results
  const lines = data.results.map(
    (r, i) => {
      const score = Number.isInteger(r.correct) ? r.correct : r.correct.toFixed(1);
      return `${i + 1}. ${r.name} — ${score} баллов`;
    }
  );
  const overallText = ["🏆 Квиз окончен! Результаты:", "", ...lines].join("\n");

  for (const user of registered) {
    try {
      // Send overall results
      await bot.api.sendMessage(user.chatId, overallText);

      // Get and send detailed results for this team
      const teamDetails = await api.getTeamDetails(data.quizId, user.teamId);
      const place = data.results.findIndex((r) => r.teamId === user.teamId) + 1;

      const totalScore = Number.isInteger(teamDetails.totalCorrect)
        ? teamDetails.totalCorrect
        : teamDetails.totalCorrect.toFixed(1);

      const detailsLines = [
        `\n📊 Детальные результаты вашей команды "${teamDetails.teamName}":`,
        `🏅 Место: ${place}`,
        `✅ Баллов: ${totalScore}`,
        "",
        ...teamDetails.details.map((d: any, idx: number) => {
          if (d.questionType === "text") {
            const score = d.awardedScore ?? 0;
            const answer = d.teamAnswer || "Не ответили";
            return `${idx + 1}. ${d.questionText}\nВаш ответ: ${answer}\nОценка: ${score}/${d.weight}`;
          }
          const icon = d.isCorrect ? "✅" : "❌";
          const answer = d.teamAnswer
            ? `${d.teamAnswer} (${d.teamAnswerText})`
            : "Не ответили";
          let line = `${idx + 1}. ${icon} ${d.questionText}\nВаш ответ: ${answer}`;
          if (!d.isCorrect) {
            line += `\nПравильный ответ: ${d.correctAnswer} (${d.correctAnswerText})`;
          }
          return line;
        }),
      ].join("\n");

      await bot.api.sendMessage(user.chatId, detailsLines);
    } catch (err) {
      console.error(`Failed to send results to ${user.chatId}:`, err);
    }
    deleteState(user.chatId);
  }
}

async function onRemind(
  bot: Bot,
  data: { quizId: number; teams: Array<{ teamId: number; telegramChatId: number | null }> }
) {
  let kb: InlineKeyboard | undefined;
  let currentQuestionId: number | null = null;
  let isTextQuestion = false;
  try {
    const gameState = await api.getGameState(data.quizId);
    currentQuestionId = gameState.currentQuestionId;
    isTextQuestion = gameState.question?.questionType === "text";
    const opts = gameState.question?.options || [];
    if (!isTextQuestion && opts.length >= 2 && opts.length <= 8) {
      kb = new InlineKeyboard();
      const letters = LABELS.slice(0, opts.length);
      for (let i = 0; i < letters.length; i += 2) {
        kb.text(letters[i], `answer:${letters[i]}`);
        if (letters[i + 1]) kb.text(letters[i + 1], `answer:${letters[i + 1]}`);
        if (i + 2 < letters.length) kb.row();
      }
    }
  } catch {
    // no buttons if API fails
  }

  for (const team of data.teams) {
    if (!team.telegramChatId) continue;
    // Set awaiting_answer so button clicks work
    if (currentQuestionId) {
      const st = getState(team.telegramChatId);
      if ((st.step === "registered" || st.step === "awaiting_answer") && "teamId" in st) {
        setState(team.telegramChatId, {
          step: "awaiting_answer",
          quizId: data.quizId,
          teamId: st.teamId,
          questionId: currentQuestionId,
        });
      }
    }
    try {
      await bot.api.sendMessage(team.telegramChatId, "⏰ Ведущий напоминает: сдай ответ!", {
        ...(kb && { reply_markup: kb }),
      });
    } catch (err) {
      console.error(`Failed to send remind to ${team.telegramChatId}:`, err);
    }
  }
}
