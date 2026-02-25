const MEDALS = ["🥇", "🥈", "🥉"];

export default function TVResults({ results }) {
  // Функция для расчёта задержки анимации:
  // 2 место появляется первым (delay=0), потом 3, 4... и 1 место последним
  const getAnimationDelay = (index) => {
    if (results.length <= 1) return 0;

    if (index === 0) {
      // 1 место — последним
      return (results.length - 1) * 0.15;
    } else {
      // 2, 3, 4... места по порядку
      return (index - 1) * 0.15;
    }
  };

  return (
    <div className="w-full h-full bg-gradient-to-b from-amber-900/95 to-stone-900 flex flex-col items-center justify-center p-24 text-white">
      <h1 className="text-9xl font-bold mb-20 drop-shadow-lg">🏆 Итоги квиза</h1>
      <div className="space-y-8 w-full max-w-6xl">
        {results.map((r, i) => (
          <div
            key={r.teamId}
            className="flex items-center gap-10 py-8 px-12 bg-white/10 backdrop-blur rounded-3xl text-6xl font-medium animate-[fadeIn_0.6s_ease-out] opacity-0"
            style={{
              animationDelay: `${getAnimationDelay(i)}s`,
              animationFillMode: 'forwards'
            }}
          >
            <span className="w-32 text-8xl text-center">
              {i < MEDALS.length ? MEDALS[i] : `${i + 1}.`}
            </span>
            <span className="flex-1">{r.name}</span>
            <span className="text-amber-300 text-5xl">
              {r.correct}/{r.total} правильных
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
