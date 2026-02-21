import WebSocket from "ws";
import { Bot, InlineKeyboard } from "grammy";
import { config } from "./config.js";
import { getAllRegistered, getRegisteredByTeamId, setState, deleteState, getState } from "./state.js";
import { api } from "./api-client.js";

const LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

/** Track last known questionId per quiz to detect "first question" = game start */
const lastQuestionId = new Map<number, number>();

export function startWsListener(bot: Bot) {
  const wsUrl = config.API_URL.replace(/^http/, "ws") + "/ws";
  console.log("WS connecting to:", wsUrl);

  function connect() {
    const ws = new WebSocket(wsUrl);

    ws.on("open", () => {
      console.log("WS connected to API");
    });

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        await handleEvent(bot, msg.event, msg.data);
      } catch (err) {
        console.error("WS message error:", err);
      }
    });

    ws.on("close", () => {
      console.log("WS disconnected, reconnecting in 3s...");
      setTimeout(connect, 3000);
    });

    ws.on("error", (err) => {
      console.error("WS error:", err);
    });
  }

  connect();
}

async function handleEvent(bot: Bot, event: string, data: any) {
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
    // Detect game start: first question we see for this quiz
    const prevQId = lastQuestionId.get(data.quizId);
    if (prevQId == null) {
      // First question — send game start message
      for (const user of registered) {
        try {
          await bot.api.sendMessage(user.chatId, "🎮 Квиз начался! Ожидайте вопросы.");
        } catch (err) {
          console.error(`Failed to send game start to ${user.chatId}:`, err);
        }
      }
    }
    lastQuestionId.set(data.quizId, data.questionId);

    // Fetch question data
    let question;
    try {
      const state = await api.getGameState(data.quizId);
      question = state.question;
    } catch {
      return;
    }
    if (!question) return;

    const options = question.options || [];
    const optionLines = options
      .map((opt: string, i: number) => `${LABELS[i]}) ${opt}`)
      .join("\n");

    const text = [
      `❓ Вопрос`,
      "",
      question.text,
      "",
      optionLines,
    ].join("\n");

    // Send question WITHOUT buttons, set awaiting_answer state
    for (const user of registered) {
      setState(user.chatId, {
        step: "awaiting_answer",
        quizId: user.quizId,
        teamId: user.teamId,
        questionId: data.questionId,
      });
      try {
        await bot.api.sendMessage(user.chatId, text);
      } catch (err) {
        console.error(`Failed to send question to ${user.chatId}:`, err);
      }
    }
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

    const options = question.options || [];

    // Build inline keyboard with answer buttons
    const replyMarkup =
      options.length >= 2 && options.length <= 8
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
          });
        }
      }
    }

    // Send "timer started" message with buttons IMMEDIATELY
    for (const user of registered) {
      try {
        await bot.api.sendMessage(user.chatId, "⏱ Время пошло! Отправь ответ.", {
          ...(replyMarkup && { reply_markup: replyMarkup }),
        });
      } catch (err) {
        console.error(`Failed to send timer to ${user.chatId}:`, err);
      }
    }
  } else if (data.slide === "answer") {
    // Get correct answer and team answers
    let correctAnswer = "";
    let answers: Array<{ teamId: number; answerText: string }> = [];
    try {
      const gameState = await api.getGameState(data.quizId);
      correctAnswer = gameState.question?.correctAnswer || "";
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
          const isCorrect = teamAnswer.answerText === correctAnswer;
          const icon = isCorrect ? "✅" : "❌";
          const text = isCorrect
            ? `Твой ответ: ${teamAnswer.answerText} ${icon} Правильно!`
            : `Твой ответ: ${teamAnswer.answerText} ${icon} Неправильно. Правильный ответ: ${correctAnswer}`;

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
  data: { quizId: number; results: Array<{ teamId: number; name: string; correct: number; total: number }> }
) {
  const registered = getAllRegistered().filter((u) => u.quizId === data.quizId);
  if (registered.length === 0) return;

  // Clean up tracking state
  lastQuestionId.delete(data.quizId);

  // Overall results
  const lines = data.results.map(
    (r, i) => `${i + 1}. ${r.name} — ${r.correct}/${r.total} правильных`
  );
  const overallText = ["🏆 Квиз окончен! Результаты:", "", ...lines].join("\n");

  for (const user of registered) {
    try {
      // Send overall results
      await bot.api.sendMessage(user.chatId, overallText);

      // Get and send detailed results for this team
      const teamDetails = await api.getTeamDetails(data.quizId, user.teamId);
      const place = data.results.findIndex((r) => r.teamId === user.teamId) + 1;

      const detailsLines = [
        `\n📊 Детальные результаты вашей команды "${teamDetails.teamName}":`,
        `🏅 Место: ${place}`,
        `✅ Правильно: ${teamDetails.totalCorrect}/${teamDetails.totalQuestions}`,
        "",
        ...teamDetails.details.map((d, idx) => {
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
  try {
    const gameState = await api.getGameState(data.quizId);
    currentQuestionId = gameState.currentQuestionId;
    const opts = gameState.question?.options || [];
    if (opts.length >= 2 && opts.length <= 8) {
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
