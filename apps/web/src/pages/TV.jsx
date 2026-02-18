import { useParams } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  quizzesApi,
  gameApi,
  questionsApi,
  getWsUrl,
} from "../api/client";
import TVQuestion from "../components/TV/TVQuestion";
import TVTimer from "../components/TV/TVTimer";
import TVAnswer from "../components/TV/TVAnswer";
import TVResults from "../components/TV/TVResults";

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

export default function TV() {
  const { quizId: urlQuizId } = useParams();
  const tvTransform = useTVScale();
  const [quizId, setQuizId] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [state, setState] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);

  const loadQuiz = useCallback(async (id) => {
    try {
      const [quizData, stateData, questionsData] = await Promise.all([
        quizzesApi.get(id),
        gameApi.getState(id).catch(() => null),
        questionsApi.list(id),
      ]);
      setQuiz(quizData);
      setState(stateData);
      setQuestions(questionsData);
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
    <div className="tv-viewport">
      <div
        className="tv-screen bg-black overflow-hidden"
        style={{ ...screenStyle, cursor: "none" }}
      >
      {state?.status === "finished" && results && results.length > 0 ? (
        <TVResults results={results} />
      ) : state?.status === "playing" && currentQuestion ? (
        <>
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
        <div className="flex flex-col items-center justify-center w-full h-full bg-stone-900 text-white gap-8">
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
      )}
      </div>
    </div>
  );
}
