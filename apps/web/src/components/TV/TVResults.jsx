const MEDALS = ["🥇", "🥈", "🥉"];

function getRevealOrder(length) {
  if (length <= 1) return [0];
  return [1, ...Array.from({ length: Math.max(0, length - 2) }, (_, i) => i + 2), 0];
}

export default function TVResults({ results, revealCount = results.length }) {
  const revealOrder = getRevealOrder(results.length);
  const visibleSet = new Set(revealOrder.slice(0, revealCount));

  return (
    <div className="w-full h-full bg-gradient-to-b from-amber-900/95 to-stone-900 flex flex-col items-center justify-center p-24 text-white">
      <h1 className="text-9xl font-bold mb-20 drop-shadow-lg">🏆 Итоги квиза</h1>
      <div className="space-y-8 w-full max-w-6xl">
        {results.map((r, i) => {
          if (!visibleSet.has(i)) return null;
          return (
            <div
              key={r.teamId}
              className="flex items-center gap-10 py-8 px-12 bg-white/10 backdrop-blur rounded-3xl text-6xl font-medium"
            >
              <span className="w-32 text-8xl text-center">
                {i < MEDALS.length ? MEDALS[i] : `${i + 1}.`}
              </span>
              <span className="flex-1">{r.name}</span>
              <span className="text-amber-300 text-5xl">
                {r.correct}/{r.total} правильных
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
