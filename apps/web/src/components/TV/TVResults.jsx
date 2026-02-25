const MEDALS = ["🥇", "🥈", "🥉"];

function getRevealOrder(length) {
  if (length <= 1) return [0];
  return [1, ...Array.from({ length: Math.max(0, length - 2) }, (_, i) => i + 2), 0];
}

export default function TVResults({ results, revealCount = results.length }) {
  const revealOrder = getRevealOrder(results.length);
  const visibleSet = new Set(revealOrder.slice(0, revealCount));

  // Адаптивные размеры в зависимости от количества команд
  const teamCount = results.length;
  const isCompact = teamCount > 5;

  const titleSize = isCompact ? "text-7xl mb-8" : "text-9xl mb-12";
  const containerPadding = isCompact ? "py-8 px-16" : "py-12 px-24";
  const itemSpacing = isCompact ? "space-y-4" : "space-y-6";
  const itemPadding = isCompact ? "py-4 px-8" : "py-6 px-10";
  const nameSize = isCompact ? "text-4xl" : "text-6xl";
  const medalSize = isCompact ? "text-6xl" : "text-8xl";
  const scoreSize = isCompact ? "text-3xl" : "text-5xl";

  return (
    <div className={`w-full h-full bg-gradient-to-b from-amber-900/95 to-stone-900 flex flex-col items-center justify-start ${containerPadding} text-white overflow-y-auto`}>
      <h1 className={`${titleSize} font-bold drop-shadow-lg flex-shrink-0`}>🏆 Итоги квиза</h1>
      <div className={`${itemSpacing} w-full max-w-6xl flex-shrink-0`}>
        {results.map((r, i) => {
          const isVisible = visibleSet.has(i);
          return (
            <div
              key={r.teamId}
              className={`flex items-center gap-6 ${itemPadding} bg-white/10 backdrop-blur rounded-3xl ${nameSize} font-medium transition-all duration-500 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 invisible"
              }`}
              style={{
                animation: isVisible ? "slideIn 0.5s ease-out forwards" : "none",
              }}
            >
              <span className={`w-24 ${medalSize} text-center flex-shrink-0`}>
                {i < MEDALS.length ? MEDALS[i] : `${i + 1}.`}
              </span>
              <span className="flex-1 truncate">{r.name}</span>
              <span className={`text-amber-300 ${scoreSize} flex-shrink-0`}>
                {r.correct}/{r.total} правильных
              </span>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
