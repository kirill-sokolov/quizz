import { useState, useEffect, useRef } from "react";
import TVSlideBg from "./TVSlideBg";

function getSlideByType(slides, type) {
  if (!Array.isArray(slides)) return null;
  return slides.find((s) => s.type === type) ?? null;
}

function useAlarm(playAtZero) {
  const playedRef = useRef(false);
  useEffect(() => {
    if (!playAtZero) {
      playedRef.current = false;
      return;
    }
    if (playedRef.current) return;
    playedRef.current = true;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch (_) {}
  }, [playAtZero]);
}

export default function TVTimer({ question, startedAt, slides }) {
  const slide = getSlideByType(slides, "timer");
  const limitSec = question?.timeLimitSec ?? 30;
  const [secondsLeft, setSecondsLeft] = useState(null);
  const playAlarm = secondsLeft === 0;
  useAlarm(playAlarm);

  useEffect(() => {
    if (!startedAt) {
      setSecondsLeft(limitSec);
      return;
    }
    const end = new Date(startedAt).getTime() + limitSec * 1000;
    const tick = () => {
      const now = Date.now();
      const left = Math.max(0, Math.ceil((end - now) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [startedAt, limitSec]);

  const progress = startedAt && limitSec > 0 ? 1 - (secondsLeft ?? limitSec) / limitSec : 0;
  let colorClass = "text-green-400";
  if (progress >= 0.66) colorClass = "text-red-500";
  else if (progress >= 0.33) colorClass = "text-yellow-400";

  return (
    <TVSlideBg imageUrl={slide?.imageUrl} videoUrl={slide?.videoUrl}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`text-[180px] font-black tabular-nums drop-shadow-2xl transition-colors duration-300 ${colorClass}`}
        >
          {secondsLeft != null ? secondsLeft : limitSec}
        </div>
        {secondsLeft === 0 && (
          <div className="absolute inset-0 bg-white/30 animate-pulse pointer-events-none" />
        )}
      </div>
    </TVSlideBg>
  );
}
