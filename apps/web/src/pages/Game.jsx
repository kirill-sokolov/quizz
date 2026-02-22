import { useParams, Link, useNavigate } from "react-router-dom";
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
  const [results, setResults] = useState(null);
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

      // Загрузить результаты если квиз завершен или архивирован
      if (quizData.status === "finished" || quizData.status === "archived") {
        const resultsData = await gameApi.getResults(quizId);
        setResults(resultsData);
      }

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

  // Автоматически запустить игру (перейти в lobby) если она еще не запущена
  useEffect(() => {
    if (loading || !quizId || !quiz) return;
    if (state === null) {
      gameApi.start(quizId).then(() => load());
    }
  }, [loading, quizId, quiz, state, load]);

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
    results,
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
  const navigate = useNavigate();
  const wsRef = useRef(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamDetails, setTeamDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [currentResults, setCurrentResults] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [showUnanswered, setShowUnanswered] = useState(false);
  const {
    quiz,
    state,
    questions,
    teams,
    answers,
    results,
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

  const handleStart = async () => {
    await gameApi.start(quizId);
    await load();
  };

  const handleOpenRegistration = async () => {
    await gameApi.openRegistration(quizId);
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
    await gameApi.archive(quizId);
    navigate("/admin");
  };

  const handleShowDetails = async (teamId) => {
    setSelectedTeam(teamId);
    setShowUnanswered(false);
    setLoadingDetails(true);
    try {
      const details = await gameApi.getTeamDetails(quizId, teamId);
      setTeamDetails(details);
    } catch (err) {
      console.error("Failed to load team details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCloseDetails = () => {
    setSelectedTeam(null);
    setTeamDetails(null);
    setShowUnanswered(false);
  };

  const handleResetToFirst = async () => {
    if (!confirm("Начать с первого вопроса? Все ответы на текущий вопрос будут сброшены.")) return;
    const newState = await gameApi.resetToFirst(quizId);
    setState(newState);
    await refreshAnswers();
  };

  const handleShowResults = async () => {
    setShowResults(true);
    setLoadingResults(true);
    try {
      const resultsData = await gameApi.getResults(quizId);
      setCurrentResults(resultsData);
    } catch (err) {
      console.error("Failed to load results:", err);
    } finally {
      setLoadingResults(false);
    }
  };

  const handleCloseResults = () => {
    setShowResults(false);
    setCurrentResults(null);
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
  const quizArchived = quiz?.status === "archived";

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

  // Lobby - правила (регистрация закрыта)
  if (gameLobby && !state?.registrationOpen) {
    return (
      <div>
        <div className="mb-4 flex items-center gap-4">
          <Link to="/admin" className="text-amber-600 hover:text-amber-700 font-medium">
            ← Квизы
          </Link>
          <h1 className="text-xl font-semibold text-stone-800">
            Подготовка: {quiz.title}
          </h1>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
          <p className="text-stone-600 mb-4">На TV экране показываются правила игры.</p>
          <button
            type="button"
            onClick={handleOpenRegistration}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium"
          >
            Открыть регистрацию
          </button>
        </div>
      </div>
    );
  }

  // Lobby - регистрация (показываем QR код)
  if (gameLobby && state?.registrationOpen) {
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

  if (gameFinished || quizArchived) {
    return (
      <div>
        <div className="mb-4 flex items-center gap-4">
          <Link to="/admin" className="text-amber-600 hover:text-amber-700 font-medium">
            ← Квизы
          </Link>
          <h1 className="text-xl font-semibold text-stone-800">
            {quiz.title} — {quizArchived ? "архивирован" : "завершён"}
          </h1>
        </div>

        {/* Результаты */}
        {results && results.length > 0 ? (
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm mb-4">
            <h2 className="text-lg font-semibold text-stone-800 mb-4">Результаты</h2>
            <div className="space-y-3">
              {results.map((result, idx) => (
                <div
                  key={result.teamId}
                  className="flex items-center gap-4 p-4 bg-stone-50 rounded-lg"
                >
                  <div className="text-2xl font-bold text-amber-600 w-12 text-center">
                    #{idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-stone-800">{result.name}</div>
                    <div className="text-sm text-stone-500">
                      {result.correct} из {result.total} правильных ответов
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <div className="text-xl font-bold text-green-600">
                        {result.correct}
                      </div>
                      <div className="text-xs text-stone-400">правильно</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleShowDetails(result.teamId)}
                      className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
                    >
                      Подробнее
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 mb-4">
            <p className="text-center text-stone-600">
              {quizArchived ? "Квиз архивирован." : "Квиз завершён."}
            </p>
          </div>
        )}

        {/* Кнопка архивировать только для завершенных */}
        {!quizArchived && (
          <div className="text-center">
            <button
              type="button"
              onClick={handleArchive}
              className="px-6 py-2 border border-stone-300 rounded-lg hover:bg-stone-100 transition text-stone-700 font-medium"
            >
              📦 Архивировать квиз
            </button>
          </div>
        )}

        {/* Модальное окно с детальными результатами */}
        {selectedTeam && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={handleCloseDetails}
          >
            <div
              className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {loadingDetails ? (
                <p className="text-center text-stone-500">Загрузка...</p>
              ) : teamDetails ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-stone-800">
                      {teamDetails.teamName}
                    </h2>
                    <button
                      type="button"
                      onClick={handleCloseDetails}
                      className="text-stone-400 hover:text-stone-600 text-2xl"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mb-6 p-4 bg-amber-50 rounded-lg">
                    <p className="text-center text-lg">
                      <span className="font-bold text-green-600">
                        {teamDetails.totalCorrect}
                      </span>{" "}
                      из {teamDetails.totalQuestions} правильных ответов
                    </p>
                  </div>
                  <div className="space-y-4">
                    {teamDetails.details.map((detail, idx) => (
                      <div
                        key={detail.questionId}
                        className={`p-4 rounded-lg border-2 ${
                          detail.isCorrect
                            ? "bg-green-50 border-green-200"
                            : "bg-red-50 border-red-200"
                        }`}
                      >
                        <div className="flex items-start gap-3 mb-2">
                          <span className="font-bold text-stone-700">
                            #{idx + 1}
                          </span>
                          <div className="flex-1">
                            <p className="font-medium text-stone-800 mb-2">
                              {detail.questionText}
                            </p>
                            <div className="text-sm space-y-1">
                              <div>
                                <span className="text-stone-600">Ответ команды: </span>
                                <span
                                  className={`font-semibold ${
                                    detail.isCorrect
                                      ? "text-green-700"
                                      : "text-red-700"
                                  }`}
                                >
                                  {detail.teamAnswer
                                    ? `${detail.teamAnswer} (${detail.teamAnswerText})`
                                    : "Не ответили"}
                                </span>
                              </div>
                              {!detail.isCorrect && (
                                <div>
                                  <span className="text-stone-600">
                                    Правильный ответ:{" "}
                                  </span>
                                  <span className="font-semibold text-green-700">
                                    {detail.correctAnswer} ({detail.correctAnswerText})
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-2xl">
                            {detail.isCorrect ? "✅" : "❌"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
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

              {/* Объяснение ответа */}
              {currentQuestion.explanation && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <span className="font-semibold">Объяснение: </span>
                    {currentQuestion.explanation}
                  </p>
                </div>
              )}
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
              disabled={!hasNextQuestion || state?.currentSlide !== "answer"}
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
              onClick={handleShowResults}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              📊 Результаты
            </button>
            <button
              type="button"
              onClick={handleFinish}
              disabled={!(currentIndex === totalQuestions && state?.currentSlide === SLIDE_TYPES.ANSWER)}
              className="px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Модальное окно с детальными результатами команды */}
      {selectedTeam && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleCloseDetails}
        >
          <div
            className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {loadingDetails ? (
              <p className="text-center text-stone-500">Загрузка...</p>
            ) : teamDetails ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-stone-800">
                    {teamDetails.teamName}
                  </h2>
                  <button
                    type="button"
                    onClick={handleCloseDetails}
                    className="text-stone-400 hover:text-stone-600 text-2xl"
                  >
                    ✕
                  </button>
                </div>
                <div className="mb-6 p-4 bg-amber-50 rounded-lg">
                  <p className="text-center text-lg">
                    <span className="font-bold text-green-600">
                      {teamDetails.totalCorrect}
                    </span>{" "}
                    из {teamDetails.totalQuestions} правильных ответов
                  </p>
                </div>
                <div className="space-y-4">
                  {(() => {
                    // Определяем текущий индекс вопроса
                    const currentQuestionIndex = currentQuestion
                      ? questions.findIndex((q) => q.id === currentQuestion.id)
                      : -1;

                    // Фильтруем детали: показываем только до текущего вопроса, если не включен режим "показать все"
                    const filteredDetails = showUnanswered
                      ? teamDetails.details
                      : teamDetails.details.filter((_, idx) => idx <= currentQuestionIndex);

                    const hasHidden = teamDetails.details.length > filteredDetails.length;

                    return (
                      <>
                        {filteredDetails.map((detail, idx) => (
                          <div
                            key={detail.questionId}
                            className={`p-4 rounded-lg border-2 ${
                              detail.isCorrect
                                ? "bg-green-50 border-green-200"
                                : "bg-red-50 border-red-200"
                            }`}
                          >
                            <div className="flex items-start gap-3 mb-2">
                              <span className="font-bold text-stone-700">
                                #{idx + 1}
                              </span>
                              <div className="flex-1">
                                <p className="font-medium text-stone-800 mb-2">
                                  {detail.questionText}
                                </p>
                                <div className="text-sm space-y-1">
                                  <div>
                                    <span className="text-stone-600">Ответ команды: </span>
                                    <span
                                      className={`font-semibold ${
                                        detail.isCorrect
                                          ? "text-green-700"
                                          : "text-red-700"
                                      }`}
                                    >
                                      {detail.teamAnswer
                                        ? `${detail.teamAnswer} (${detail.teamAnswerText})`
                                        : "Не ответили"}
                                    </span>
                                  </div>
                                  {!detail.isCorrect && (
                                    <div>
                                      <span className="text-stone-600">
                                        Правильный ответ:{" "}
                                      </span>
                                      <span className="font-semibold text-green-700">
                                        {detail.correctAnswer} ({detail.correctAnswerText})
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-2xl">
                                {detail.isCorrect ? "✅" : "❌"}
                              </div>
                            </div>
                          </div>
                        ))}
                        {hasHidden && !showUnanswered && (
                          <button
                            type="button"
                            onClick={() => setShowUnanswered(true)}
                            className="w-full px-4 py-3 border-2 border-dashed border-stone-300 rounded-lg text-stone-600 hover:bg-stone-50 hover:border-stone-400 transition"
                          >
                            📋 Показать ещё не отвеченные ({teamDetails.details.length - filteredDetails.length})
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Модальное окно с общими результатами */}
      {showResults && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleCloseResults}
        >
          <div
            className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {loadingResults ? (
              <p className="text-center text-stone-500">Загрузка...</p>
            ) : currentResults ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-stone-800">
                    Текущие результаты
                  </h2>
                  <button
                    type="button"
                    onClick={handleCloseResults}
                    className="text-stone-400 hover:text-stone-600 text-2xl"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-3">
                  {currentResults.map((result, idx) => (
                    <div
                      key={result.teamId}
                      className="flex items-center gap-4 p-4 bg-stone-50 rounded-lg"
                    >
                      <div className="text-2xl font-bold text-amber-600 w-12 text-center">
                        #{idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-stone-800">{result.name}</div>
                        <div className="text-sm text-stone-500">
                          {result.correct} из {result.total} правильных
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <div className="text-xl font-bold text-green-600">
                            {result.correct}
                          </div>
                          <div className="text-xs text-stone-400">правильно</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            handleCloseResults();
                            handleShowDetails(result.teamId);
                          }}
                          className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
                        >
                          Подробнее
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
