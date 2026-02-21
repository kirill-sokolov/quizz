import { useParams, Link } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  quizzesApi,
  gameApi,
  questionsApi,
  teamsApi,
  answersApi,
  getWsUrl,
} from "../api/client";
import { SLIDE_TYPES, BASE_SLIDE_TYPES, FULL_SLIDE_TYPES, TV_SLIDE_LABELS } from "../constants/slides";

const SLIDE_LABELS = TV_SLIDE_LABELS;

function getSlideOrder(question) {
  if (!question?.slides) return BASE_SLIDE_TYPES;
  const types = question.slides.map(s => s.type);
  const hasVideoWarning = types.includes(SLIDE_TYPES.VIDEO_WARNING);
  const hasVideoIntro = types.includes(SLIDE_TYPES.VIDEO_INTRO);

  const order = [];
  if (hasVideoWarning) order.push(SLIDE_TYPES.VIDEO_WARNING);
  if (hasVideoIntro) order.push(SLIDE_TYPES.VIDEO_INTRO);
  order.push(SLIDE_TYPES.QUESTION, SLIDE_TYPES.TIMER, SLIDE_TYPES.ANSWER);
  return order;
}

function useGameState(quizId) {
  const [quiz, setQuiz] = useState(null);
  const [state, setState] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!quizId) return;
    try {
      const [quizData, stateData, questionsData, teamsData] = await Promise.all([
        quizzesApi.get(quizId),
        gameApi.getState(quizId).catch(() => null),
        questionsApi.list(quizId),
        teamsApi.list(quizId, true),
      ]);
      setQuiz(quizData);
      setState(stateData);
      setQuestions(questionsData);
      setTeams(teamsData);
      if (stateData?.currentQuestionId) {
        const ans = await answersApi.list(stateData.currentQuestionId);
        setAnswers(ans);
      } else {
        setAnswers([]);
      }
    } catch (e) {
      setError(e.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshAnswers = useCallback(async () => {
    if (state?.currentQuestionId) {
      const ans = await answersApi.list(state.currentQuestionId);
      setAnswers(ans);
    }
  }, [state?.currentQuestionId]);

  const refreshTeams = useCallback(async () => {
    const list = await teamsApi.list(quizId, true);
    setTeams(list);
  }, [quizId]);

  return {
    quiz,
    state,
    questions,
    teams,
    answers,
    loading,
    error,
    setState,
    setAnswers,
    setTeams,
    refreshAnswers,
    refreshTeams,
    load,
  };
}

function TimerDisplay({ startedAt, limitSec }) {
  const [left, setLeft] = useState(null);
  useEffect(() => {
    if (!startedAt || limitSec == null) {
      setLeft(null);
      return;
    }
    const end = new Date(startedAt).getTime() + limitSec * 1000;
    const tick = () => {
      const now = Date.now();
      const sec = Math.max(0, Math.ceil((end - now) / 1000));
      setLeft(sec);
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [startedAt, limitSec]);
  if (left == null) return null;
  return (
    <div className="text-2xl font-mono font-semibold text-amber-800">
      ⏱ {left} сек
    </div>
  );
}

export default function Game() {
  const { id } = useParams();
  const quizId = Number(id);
  const wsRef = useRef(null);
  const {
    quiz,
    state,
    questions,
    teams,
    answers,
    loading,
    error,
    setState,
    setAnswers,
    setTeams,
    refreshAnswers,
    refreshTeams,
    load,
  } = useGameState(quizId);

  const currentQuestion = state?.currentQuestionId
    ? questions.find((q) => q.id === state.currentQuestionId)
    : null;
  const currentIndex = currentQuestion
    ? questions.findIndex((q) => q.id === currentQuestion.id) + 1
    : 0;
  const totalQuestions = questions.length;
  const submittedTeamIds = new Set(answers.map((a) => a.teamId));
  const activeTeams = teams.filter((t) => !t.isKicked);
  const allTeamsForBottom = teams;

  useEffect(() => {
    if (!quizId || !state) return;
    const wsUrl = getWsUrl();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const { event, data } = JSON.parse(ev.data);
        if (data?.quizId !== quizId) return;
        switch (event) {
          case "game_lobby":
            load();
            break;
          case "registration_opened":
            gameApi.getState(quizId).then((s) => setState(s));
            break;
          case "slide_changed":
            gameApi.getState(quizId).then((s) => setState(s));
            if (data.slide === "timer") refreshAnswers();
            break;
          case "answer_submitted":
            refreshAnswers();
            break;
          case "team_registered":
            refreshTeams();
            break;
          case "team_kicked":
            refreshTeams();
            break;
          case "quiz_finished":
            load();
            break;
          default:
            break;
        }
      } catch (_) {}
    };
    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [quizId, state?.quizId, setState, refreshAnswers, refreshTeams, load]);

  // Автоматически открыть регистрацию при переходе на страницу управления
  useEffect(() => {
    if (state?.status === "lobby" && state?.registrationOpen === false) {
      gameApi.openRegistration(quizId).then(() => load());
    }
  }, [state?.status, state?.registrationOpen, quizId, load]);

  const handleStart = async () => {
    await gameApi.start(quizId);
    await load();
  };

  const handleSetSlide = async (slide) => {
    await gameApi.setSlide(quizId, slide);
    const newState = await gameApi.getState(quizId);
    setState(newState);
  };

  const handleNextQuestion = async () => {
    const result = await gameApi.nextQuestion(quizId);
    if (result?.done) {
      await load();
      return;
    }
    if (result) setState(result);
    setAnswers([]);
  };

  const handleRemind = async (teamId) => {
    await gameApi.remind(quizId, teamId);
  };

  const handleKick = async (teamId) => {
    await teamsApi.kick(teamId);
    await refreshTeams();
  };

  const handleFinish = async () => {
    await gameApi.finish(quizId);
    await load();
  };

  const handleArchive = async () => {
    if (!confirm("Архивировать квиз? Он больше не будет показываться на TV.")) return;
    await quizzesApi.update(quizId, { status: "archived" });
    await load();
  };

  const handleResetToFirst = async () => {
    if (!confirm("Начать с первого вопроса? Все ответы на текущий вопрос будут сброшены.")) return;
    const newState = await gameApi.resetToFirst(quizId);
    setState(newState);
    await refreshAnswers();
  };

  if (loading) return <p className="text-stone-500">Загрузка…</p>;
  if (error)
    return (
      <div>
        <p className="text-red-600 mb-2">{error}</p>
        <Link to="/admin" className="text-amber-600 hover:underline">
          ← К списку квизов
        </Link>
      </div>
    );
  if (!quiz)
    return (
      <p className="text-stone-500">
        <Link to="/admin" className="text-amber-600 hover:underline">
          Вернуться к списку
        </Link>
      </p>
    );

  const gameNotStarted = !state;
  const gameLobby = state?.status === "lobby";
  const gameFinished = state?.status === "finished";

  const handleBegin = async () => {
    await gameApi.begin(quizId);
    await load();
  };

  if (gameNotStarted) {
    return (
      <div>
        <div className="mb-4 flex items-center gap-4">
          <Link to="/admin" className="text-amber-600 hover:text-amber-700 font-medium">
            ← Квизы
          </Link>
          <h1 className="text-xl font-semibold text-stone-800">
            Управление игрой: {quiz.title}
          </h1>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <p className="text-stone-600 mb-4">Квиз ещё не запущен.</p>
          <button
            type="button"
            onClick={handleStart}
            className="px-6 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition font-medium"
          >
            Запустить квиз
          </button>
        </div>
      </div>
    );
  }

  if (gameLobby) {
    return (
      <div className="space-y-6">
        <div className="mb-4 flex items-center gap-4">
          <Link to="/admin" className="text-amber-600 hover:text-amber-700 font-medium">
            ← Квизы
          </Link>
          <h1 className="text-xl font-semibold text-stone-800">
            Регистрация: {quiz.title}
          </h1>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <p className="text-stone-500 mb-2">Код для входа:</p>
          <p className="text-5xl font-mono font-bold text-amber-700 tracking-widest mb-6">
            {quiz.joinCode}
          </p>
          <p className="text-stone-500 text-sm">
            Капитаны вводят этот код в Telegram-боте для регистрации
          </p>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <h2 className="font-semibold text-stone-800 mb-3">
            Зарегистрированные команды ({activeTeams.length})
          </h2>
          {teams.length === 0 ? (
            <p className="text-stone-400 text-sm">Пока никто не зарегистрировался…</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {teams.map((team) => (
                <span
                  key={team.id}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm ${
                    team.isKicked
                      ? "bg-red-50 border-red-200 text-stone-500"
                      : "bg-white border-stone-200"
                  }`}
                >
                  {team.name}
                  {team.isKicked ? (
                    <span className="text-red-500">исключён</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleKick(team.id)}
                      className="text-red-500 hover:text-red-700"
                      title="Исключить"
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={handleBegin}
            disabled={activeTeams.length === 0}
            className="px-8 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition font-medium text-lg disabled:opacity-50"
          >
            Начать квиз
          </button>
        </div>
      </div>
    );
  }

  if (gameFinished) {
    return (
      <div>
        <div className="mb-4 flex items-center gap-4">
          <Link to="/admin" className="text-amber-600 hover:text-amber-700 font-medium">
            ← Квизы
          </Link>
          <h1 className="text-xl font-semibold text-stone-800">
            {quiz.title} — завершён
          </h1>
        </div>
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 space-y-4">
          <p className="text-center text-stone-600">
            Квиз завершён. Результаты можно посмотреть в TV-режиме.
          </p>
          <div className="text-center">
            <button
              type="button"
              onClick={handleArchive}
              className="px-6 py-2 border border-stone-300 rounded-lg hover:bg-stone-100 transition text-stone-700 font-medium"
            >
              📦 Архивировать квиз
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentSlide = state.currentSlide || SLIDE_TYPES.QUESTION;
  const slideOrder = getSlideOrder(currentQuestion);
  const slideIndex = slideOrder.indexOf(currentSlide);
  const canPrevSlide = slideIndex > 0;

  // Блокируем кнопку ▶ на таймере, пока не все засабмитили
  const allTeamsSubmitted = activeTeams.length === 0 || activeTeams.every(t => submittedTeamIds.has(t.id));
  const isTimerSlide = currentSlide === SLIDE_TYPES.TIMER;
  const canNextSlide = slideIndex < slideOrder.length - 1 && (!isTimerSlide || allTeamsSubmitted);

  const hasNextQuestion = currentIndex < totalQuestions;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/admin" className="text-amber-600 hover:text-amber-700 font-medium">
          ← Квизы
        </Link>
        <h1 className="text-xl font-semibold text-stone-800">
          {quiz.title} — вопрос {currentIndex} из {totalQuestions}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Левая колонка — вопрос и слайды */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          {currentQuestion && (
            <>
              <p className="text-stone-700 whitespace-pre-wrap mb-4">
                {currentQuestion.text || "(нет текста)"}
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {currentQuestion.options?.map((opt, i) => (
                  <span
                    key={i}
                    className={`px-3 py-1 rounded-lg text-sm ${
                      String.fromCharCode(65 + i) === currentQuestion.correctAnswer
                        ? "bg-green-100 text-green-800"
                        : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {String.fromCharCode(65 + i)}) {opt}
                  </span>
                ))}
              </div>
            </>
          )}

          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm text-stone-500">Слайд:</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!canPrevSlide}
                onClick={() => handleSetSlide(slideOrder[slideIndex - 1])}
                className="px-3 py-1.5 rounded-lg border border-stone-300 disabled:opacity-40 hover:bg-stone-50"
              >
                ◀
              </button>
              <span className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg font-medium min-w-[6rem] text-center">
                {SLIDE_LABELS[currentSlide]}
              </span>
              <button
                type="button"
                disabled={!canNextSlide}
                onClick={() => handleSetSlide(slideOrder[slideIndex + 1])}
                className="px-3 py-1.5 rounded-lg border border-stone-300 disabled:opacity-40 hover:bg-stone-50"
              >
                ▶
              </button>
            </div>
          </div>

          {currentSlide === SLIDE_TYPES.TIMER && currentQuestion && (
            <TimerDisplay
              startedAt={state.timerStartedAt}
              limitSec={currentQuestion.timeLimitSec}
            />
          )}

          <div className="flex gap-2 mt-4 pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={handleNextQuestion}
              disabled={!hasNextQuestion}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-medium"
            >
              → Следующий вопрос
            </button>
            <button
              type="button"
              onClick={handleResetToFirst}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              ↺ К первому вопросу
            </button>
            <button
              type="button"
              onClick={handleFinish}
              className="px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50"
            >
              Завершить квиз
            </button>
          </div>
        </div>

        {/* Правая колонка — команды сдали / не сдали */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <h2 className="font-semibold text-stone-800 mb-2">
            Команды ({answers.length}/{activeTeams.length} сдали)
          </h2>
          <ul className="space-y-2 mb-4">
            {activeTeams.map((team) => {
              const submitted = submittedTeamIds.has(team.id);
              return (
                <li
                  key={team.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span>
                    {submitted ? "✅" : "⏳"} {team.name}
                  </span>
                  {!submitted && (
                    <button
                      type="button"
                      onClick={() => handleRemind(team.id)}
                      className="text-sm text-amber-600 hover:underline"
                    >
                      Напомнить
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {activeTeams.some((t) => !submittedTeamIds.has(t.id)) && (
            <button
              type="button"
              onClick={() => handleRemind()}
              className="w-full px-3 py-2 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 text-sm"
            >
              📢 Напомнить всем несдавшим
            </button>
          )}
        </div>
      </div>

      {/* Нижняя панель — капитаны, кик */}
      <div className="bg-stone-50 rounded-xl border border-stone-200 p-4">
        <h2 className="text-sm font-medium text-stone-600 mb-2">
          Зарегистрированные капитаны
        </h2>
        <div className="flex flex-wrap gap-2">
          {allTeamsForBottom.map((team) => (
            <span
              key={team.id}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm ${
                team.isKicked
                  ? "bg-red-50 border-red-200 text-stone-500"
                  : "bg-white border-stone-200"
              }`}
            >
              {team.name}
              {team.isKicked ? (
                <span className="text-red-500">исключён</span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleKick(team.id)}
                  className="text-red-500 hover:text-red-700"
                  title="Исключить"
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
