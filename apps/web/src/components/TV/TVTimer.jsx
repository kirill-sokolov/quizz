import { useState, useEffect, useRef } from "react";
import TVSlideBg from "./TVSlideBg";
import { SLIDE_TYPES } from "../../constants/slides";

function getSlideByType(slides, type) {
  if (!Array.isArray(slides)) return null;
  return slides.find((s) => s.type === type) ?? null;
}

function useAlarm(playAtZero) {
  const ctxRef = useRef(null);

  useEffect(() => {
    if (!playAtZero) {
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
      return;
    }
    if (ctxRef.current) return; // already ringing

    let ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = ctx;

      // Resume AudioContext if suspended (browser autoplay policy)
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch (_) {
      return;
    }

    // ~4 seconds of alarm: 7 groups × 3 beeps each
    const BEEP_DUR = 0.13;   // seconds per beep
    const BEEP_GAP = 0.07;   // gap between beeps in a group
    const GROUP_GAP = 0.40;  // pause between groups
    const PER_GROUP = 3;
    const GROUPS = 7;        // 7 groups × (3×0.13 + 2×0.07 + 0.40) ≈ 4.2 sec

    let t = ctx.currentTime + 0.05;
    for (let g = 0; g < GROUPS; g++) {
      for (let b = 0; b < PER_GROUP; b++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        // Alarm-style: two-tone sweep per beep
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.setValueAtTime(1200, t + BEEP_DUR * 0.5);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.9, t + 0.01);
        gain.gain.setValueAtTime(0.9, t + BEEP_DUR - 0.02);
        gain.gain.linearRampToValueAtTime(0, t + BEEP_DUR);

        osc.start(t);
        osc.stop(t + BEEP_DUR);

        t += BEEP_DUR + BEEP_GAP;
      }
      t += GROUP_GAP;
    }

    return () => {
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
    };
  }, [playAtZero]);
}

// Звук тика каждую секунду
function useTickSound(secondsLeft, isDone) {
  const prevSecondsRef = useRef(null);

  useEffect(() => {
    if (isDone || secondsLeft == null || secondsLeft === prevSecondsRef.current) return;

    prevSecondsRef.current = secondsLeft;

    // Воспроизводим тик только если таймер идет
    if (secondsLeft > 0 && secondsLeft < 100) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Resume AudioContext if suspended
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        // Короткий клик
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.05);

        setTimeout(() => ctx.close(), 100);
      } catch (_) {
        // Ignore audio errors
      }
    }
  }, [secondsLeft, isDone]);
}

export default function TVTimer({ question, startedAt, slides }) {
  const slide = getSlideByType(slides, SLIDE_TYPES.TIMER);
  const limitSec = question?.timeLimitSec ?? 30;
  const timerPosition = question?.timerPosition ?? "center";
  const [secondsLeft, setSecondsLeft] = useState(null);
  const isDone = secondsLeft === 0;
  useAlarm(isDone);
  useTickSound(secondsLeft, isDone);

  useEffect(() => {
    if (!startedAt) {
      setSecondsLeft(limitSec);
      return;
    }
    const end = new Date(startedAt).getTime() + limitSec * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
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

  // Определяем CSS классы для позиционирования
  const positionClasses = {
    center: "items-center justify-center",
    top: "items-start justify-center pt-16",
    bottom: "items-end justify-center pb-16",
    left: "items-center justify-start pl-16",
    right: "items-center justify-end pr-16",
    "top-left": "items-start justify-start pt-16 pl-16",
    "top-right": "items-start justify-end pt-16 pr-16",
    "bottom-left": "items-end justify-start pb-16 pl-16",
    "bottom-right": "items-end justify-end pb-16 pr-16",
  };

  const positionClass = positionClasses[timerPosition] || positionClasses.center;

  return (
    <TVSlideBg imageUrl={slide?.imageUrl} videoUrl={slide?.videoUrl}>
      <div className={`absolute inset-0 flex ${positionClass}`}>
        {isDone ? (
          <div className="flex flex-col items-center gap-6">
            <div
              className="text-[220px] leading-none select-none"
              style={{ animation: "alarmRing 0.4s ease-in-out infinite alternate" }}
            >
              ⏰
            </div>
            <div className="text-white text-5xl font-black drop-shadow-2xl tracking-wide"
              style={{ animation: "alarmPulse 0.8s ease-in-out infinite" }}
            >
              ВРЕМЯ ВЫШЛО!
            </div>
          </div>
        ) : (
          <div
            className={`text-[180px] font-black tabular-nums drop-shadow-2xl transition-colors duration-300 ${colorClass}`}
          >
            {secondsLeft != null ? secondsLeft : limitSec}
          </div>
        )}
      </div>
      {isDone && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ animation: "alarmFlash 0.8s ease-in-out infinite" }}
        />
      )}
    </TVSlideBg>
  );
}
