import { useParams } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  quizzesApi,
  gameApi,
  questionsApi,
  teamsApi,
  getWsUrl,
} from "../api/client";
import TVQuestion from "../components/TV/TVQuestion";
import TVTimer from "../components/TV/TVTimer";
import TVAnswer from "../components/TV/TVAnswer";
import TVResults from "../components/TV/TVResults";
import TVVideoWarning from "../components/TV/TVVideoWarning";
import TVVideoIntro from "../components/TV/TVVideoIntro";

const W = 1920;
const H = 1080;

function calcTransform() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  const x = Math.round((window.innerWidth - W * s) / 2);
  const y = Math.round((window.innerHeight - H * s) / 2);
  return `translate(${x}px, ${y}px) scale(${s})`;
}

function useTVScale() {
  const [transform, setTransform] = useState(calcTransform);
  useEffect(() => {
    const update = () => setTransform(calcTransform());
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return transform;
}

function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggle = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);
  return { isFullscreen, toggle };
}

export default function TV() {
  const { quizId: urlQuizId } = useParams();
  const tvTransform = useTVScale();
  const { isFullscreen, toggle } = useFullscreen();
  const [quizId, setQuizId] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [state, setState] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);

  const loadQuiz = useCallback(async (id) => {
    try {
      const [quizData, stateData, questionsData, teamsData] = await Promise.all([
        quizzesApi.get(id),
        gameApi.getState(id).catch(() => null),
        questionsApi.list(id),
        teamsApi.list(id, true).catch(() => []),
      ]);
      setQuiz(quizData);
      setState(stateData);
      setQuestions(questionsData);
      setTeams(teamsData.filter((t) => !t.isKicked));
      setResults(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      let id = urlQuizId ? Number(urlQuizId) : null;
      if (!id) {
        try {
          const active = await quizzesApi.getActive();
          id = active[0]?.id ?? null;
        } catch {
          setError("Нет активного квиза");
          setLoading(false);
          return;
        }
      }
      if (!cancelled && id) {
        setQuizId(id);
        await loadQuiz(id);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [urlQuizId, loadQuiz]);

  useEffect(() => {
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const { event, data } = JSON.parse(ev.data);

        // If we don't have a quizId yet, pick it up from the first event
        if (!quizId && data?.quizId) {
          const newId = data.quizId;
          setQuizId(newId);
          setLoading(true);
          loadQuiz(newId).then(() => setLoading(false));
          return;
        }

        if (data?.quizId !== quizId) return;
        switch (event) {
          case "game_lobby":
            loadQuiz(quizId);
            break;
          case "team_registered":
            teamsApi.list(quizId, true).then((t) => setTeams(t.filter((team) => !team.isKicked)));
            break;
          case "team_kicked":
            setTeams((prev) => prev.filter((t) => t.id !== data.teamId));
            break;
          case "slide_changed":
            gameApi.getState(quizId).then((s) => setState(s));
            break;
          case "quiz_finished":
            setResults(data.results ?? []);
            setState((prev) => (prev ? { ...prev, status: "finished" } : null));
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
  }, [quizId, loadQuiz]);

  const screenStyle = {
    width: W,
    height: H,
    transform: tvTransform,
  };

  if (loading) {
    return (
      <div className="tv-viewport">
        <div className="tv-screen" style={screenStyle}>
          <div className="flex items-center justify-center h-full bg-stone-900 text-white text-2xl">
            Загрузка…
          </div>
        </div>
      </div>
    );
  }

  if (error || !quizId) {
    return (
      <div className="tv-viewport">
        <div className="tv-screen" style={screenStyle}>
          <div className="flex items-center justify-center h-full bg-stone-900 text-white text-2xl">
            {error || "Открой квиз в админке и запусти игру"}
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = state?.currentQuestionId
    ? questions.find((q) => q.id === state.currentQuestionId)
    : null;
  const currentIndex = currentQuestion
    ? questions.findIndex((q) => q.id === currentQuestion.id) + 1
    : 0;
  const totalQuestions = questions.length;
  const slide = state?.currentSlide || "question";

  return (
    <div className="tv-viewport" onClick={toggle}>
      <div
        className="tv-screen bg-black overflow-hidden"
        style={{ ...screenStyle, cursor: "none" }}
      >
      {state?.status === "finished" && results && results.length > 0 ? (
        <TVResults results={results} />
      ) : state?.status === "playing" && currentQuestion ? (
        <>
          {slide === "video_warning" && (
            <TVVideoWarning
              currentIndex={currentIndex}
              totalQuestions={totalQuestions}
              slides={currentQuestion.slides}
            />
          )}
          {slide === "video_intro" && (
            <TVVideoIntro
              currentIndex={currentIndex}
              totalQuestions={totalQuestions}
              slides={currentQuestion.slides}
            />
          )}
          {slide === "question" && (
            <TVQuestion
              question={currentQuestion}
              currentIndex={currentIndex}
              totalQuestions={totalQuestions}
              slides={currentQuestion.slides}
            />
          )}
          {slide === "timer" && (
            <TVTimer
              question={currentQuestion}
              startedAt={state.timerStartedAt}
              slides={currentQuestion.slides}
            />
          )}
          {slide === "answer" && (
            <TVAnswer
              question={currentQuestion}
              currentIndex={currentIndex}
              totalQuestions={totalQuestions}
              slides={currentQuestion.slides}
            />
          )}
        </>
      ) : (
        <div className="flex w-full h-full bg-stone-900 text-white">
          <div className="flex flex-col items-center justify-center flex-1 gap-8">
            <p className="text-4xl">Ожидание начала квиза…</p>
            {quiz?.joinCode && (
              <>
                <p className="text-2xl text-stone-400">Код для входа:</p>
                <p className="text-8xl font-mono font-bold tracking-widest text-amber-400">
                  {quiz.joinCode}
                </p>
              </>
            )}
          </div>
          {teams.length > 0 && (
            <div className="w-[400px] border-l border-stone-700 p-8 flex flex-col">
              <h3 className="text-2xl font-bold mb-6">Команды ({teams.length})</h3>
              <div className="flex-1 overflow-y-auto space-y-3">
                {teams.map((team, idx) => (
                  <div key={team.id} className="bg-stone-800 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-amber-400">#{idx + 1}</span>
                      <span className="text-xl">{team.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
      {!isFullscreen && (
        <div className="tv-fullscreen-hint">
          Нажмите для полного экрана
        </div>
      )}
    </div>
  );
}
