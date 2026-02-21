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
import TVDemo from "../components/TV/TVDemo";
import TVRules from "../components/TV/TVRules";
import TVLobby from "../components/TV/TVLobby";
import { SLIDE_TYPES } from "../constants/slides";

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
          // Try to get active quiz first, otherwise get the latest quiz
          const active = await quizzesApi.getActive();
          if (active && active.length > 0) {
            id = active[0].id;
          } else {
            // No active quiz, get the latest quiz
            const all = await quizzesApi.list();
            id = all[0]?.id ?? null;
          }
        } catch {
          setError("Нет квизов");
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
    let reconnectTimer = null;

    const connect = () => {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WS connected");
      };

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
          console.log("WS event:", event, data);
          switch (event) {
            case "game_lobby":
              console.log("game_lobby → loading quiz and state");
              loadQuiz(quizId);
              gameApi.getState(quizId).then((s) => {
                console.log("game_lobby → state loaded:", s);
                setState(s);
              }).catch((err) => {
                console.error("game_lobby → failed to load state:", err);
              });
              break;
            case "registration_opened":
              console.log("registration_opened → loading state");
              gameApi.getState(quizId).then((s) => {
                console.log("registration_opened → state loaded:", s);
                setState(s);
              });
              break;
            case "team_registered":
              teamsApi.list(quizId, true).then((t) => setTeams(t.filter((team) => !team.isKicked)));
              break;
            case "team_kicked":
              setTeams((prev) => prev.filter((t) => t.id !== data.teamId));
              break;
            case "slide_changed":
              console.log("slide_changed → loading state");
              gameApi.getState(quizId).then((s) => {
                console.log("slide_changed → state loaded:", s);
                setState(s);
              });
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

      ws.onerror = (err) => {
        console.error("WS error:", err);
      };

      ws.onclose = () => {
        console.log("WS disconnected, reconnecting in 3s...");
        wsRef.current = null;
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
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
  const slide = state?.currentSlide || SLIDE_TYPES.QUESTION;

  console.log("TV render - state:", state, "teams:", teams.length, "quiz:", quiz?.title);

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
          {slide === SLIDE_TYPES.VIDEO_WARNING && (
            <TVVideoWarning
              key={`${currentQuestion.id}-video-warning`}
              currentIndex={currentIndex}
              totalQuestions={totalQuestions}
              slides={currentQuestion.slides}
            />
          )}
          {slide === SLIDE_TYPES.VIDEO_INTRO && (
            <TVVideoIntro
              key={`${currentQuestion.id}-video-intro`}
              currentIndex={currentIndex}
              totalQuestions={totalQuestions}
              slides={currentQuestion.slides}
            />
          )}
          {slide === SLIDE_TYPES.QUESTION && (
            <TVQuestion
              key={`${currentQuestion.id}-question`}
              question={currentQuestion}
              currentIndex={currentIndex}
              totalQuestions={totalQuestions}
              slides={currentQuestion.slides}
            />
          )}
          {slide === SLIDE_TYPES.TIMER && (
            <TVTimer
              key={`${currentQuestion.id}-timer`}
              question={currentQuestion}
              startedAt={state.timerStartedAt}
              slides={currentQuestion.slides}
            />
          )}
          {slide === SLIDE_TYPES.ANSWER && (
            <TVAnswer
              key={`${currentQuestion.id}-answer`}
              question={currentQuestion}
              currentIndex={currentIndex}
              totalQuestions={totalQuestions}
              slides={currentQuestion.slides}
            />
          )}
        </>
      ) : state?.status === "lobby" && state?.registrationOpen ? (
        <TVLobby quiz={quiz} teams={teams} />
      ) : state?.status === "lobby" ? (
        <TVRules imageUrl={quiz?.rulesImageUrl} />
      ) : (
        <TVDemo imageUrl={quiz?.demoImageUrl} />
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
