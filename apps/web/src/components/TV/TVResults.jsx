const MEDALS = ["🥇", "🥈", "🥉"];

export default function TVResults({ results }) {
  return (
    <div className="w-full h-full bg-gradient-to-b from-amber-900/95 to-stone-900 flex flex-col items-center justify-center p-24 text-white">
      <h1 className="text-6xl font-bold mb-16 drop-shadow-lg">🏆 Итоги квиза</h1>
      <div className="space-y-6 w-full max-w-4xl">
        {results.map((r, i) => (
          <div
            key={r.teamId}
            className="flex items-center gap-8 py-5 px-8 bg-white/10 backdrop-blur rounded-2xl text-3xl font-medium animate-[fadeIn_0.5s_ease-out]"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <span className="w-16 text-4xl text-center">
              {i < MEDALS.length ? MEDALS[i] : `${i + 1}.`}
            </span>
            <span className="flex-1">{r.name}</span>
            <span className="text-amber-300">
              {r.correct}/{r.total} правильных
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
