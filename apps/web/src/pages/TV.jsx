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

function useTVScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => {
      const s = Math.min(window.innerWidth / W, window.innerHeight / H);
      setScale(s);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return scale;
}

export default function TV() {
  const { quizId: urlQuizId } = useParams();
  const scale = useTVScale();
  const [quizId, setQuizId] = useState(null);
  const [state, setState] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);

  const loadQuiz = useCallback(async (id) => {
    try {
      const [stateData, questionsData] = await Promise.all([
        gameApi.getState(id).catch(() => null),
        questionsApi.list(id),
      ]);
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
    if (!quizId) return;
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const { event, data } = JSON.parse(ev.data);
        if (data?.quizId !== quizId) return;
        switch (event) {
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
  }, [quizId]);

  const screenStyle = {
    width: W,
    height: H,
    transform: `scale(${scale})`,
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
        <div className="flex items-center justify-center w-full h-full bg-stone-900 text-white text-4xl">
          Ожидание начала квиза…
        </div>
      )}
      </div>
    </div>
  );
}
