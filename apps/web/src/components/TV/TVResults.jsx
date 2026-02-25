const MEDALS = ["🥇", "🥈", "🥉"];

function getRevealOrder(length) {
  if (length <= 1) return [0];
  return [1, ...Array.from({ length: Math.max(0, length - 2) }, (_, i) => i + 2), 0];
}

export default function TVResults({ results, revealCount = results.length }) {
  const revealOrder = getRevealOrder(results.length);
  const visibleSet = new Set(revealOrder.slice(0, revealCount));

  const teamCount = results.length;
  const usePodium = teamCount > 8; // 9+ команд → пьедестал

  // Умное распределение команд по столбцам
  let centerTeams, leftTeams, rightTeams;
  if (usePodium) {
    centerTeams = results.slice(0, 8); // Первые 8 всегда в центре
    const remaining = teamCount - 8;

    if (remaining <= 7) {
      // 9-15 команд: делим остаток пополам между левым и правым
      const leftCount = Math.ceil(remaining / 2);
      leftTeams = results.slice(8, 8 + leftCount);
      rightTeams = results.slice(8 + leftCount);
    } else {
      // 16-21 команда: лево 7, право остаток (max 6)
      leftTeams = results.slice(8, 15);
      rightTeams = results.slice(15, 21);
    }
  }

  // Единые размеры блоков (как раньше для компактного режима)
  const titleSize = usePodium ? "text-7xl mb-8" : teamCount > 5 ? "text-7xl mb-8" : "text-9xl mb-12";
  const containerPadding = "py-8 px-12";
  const itemSpacing = "space-y-4";
  const itemPadding = "py-4 px-6";
  const nameSize = "text-3xl";
  const medalSize = "text-5xl";
  const scoreSize = "text-2xl";

  const renderTeam = (r, i, columnOffset = 0) => {
    const globalIndex = i + columnOffset;
    const isVisible = visibleSet.has(globalIndex);

    if (!isVisible) {
      if (globalIndex === 0) {
        // Забронированный слот для 1-го места
        return (
          <div
            key={r.teamId}
            className={`flex items-center gap-4 ${itemPadding} border-2 border-dashed border-amber-400/40 rounded-2xl ${nameSize} font-medium`}
          >
            <span className={`w-20 ${medalSize} text-center flex-shrink-0 opacity-40`}>
              🥇
            </span>
            <span className="flex-1 opacity-30 tracking-widest">• • •</span>
          </div>
        );
      }
      return null;
    }

    return (
      <div
        key={r.teamId}
        className={`flex items-center gap-4 ${itemPadding} bg-white/10 backdrop-blur rounded-2xl ${nameSize} font-medium`}
        style={{
          animation: "slideIn 0.5s ease-out forwards",
        }}
      >
        <span className={`w-20 ${medalSize} text-center flex-shrink-0`}>
          {globalIndex < MEDALS.length ? MEDALS[globalIndex] : `${globalIndex + 1}.`}
        </span>
        <span className="flex-1 truncate">{r.name}</span>
        <span className={`text-amber-300 ${scoreSize} flex-shrink-0`}>
          {r.correct}/{r.total}
        </span>
      </div>
    );
  };

  if (usePodium) {
    return (
      <div className={`w-full h-full bg-gradient-to-b from-amber-900/95 to-stone-900 flex flex-col items-center justify-center ${containerPadding} text-white overflow-hidden`}>
        <h1 className={`${titleSize} font-bold drop-shadow-lg flex-shrink-0`}>🏆 Итоги квиза</h1>

        <div className="flex gap-6 w-full max-w-[98%] items-end justify-center">
          {/* Левый столбец: 9-15 места — прижат снизу к уровню 8-го места */}
          {leftTeams.length > 0 && (
            <div className={`flex-1 max-w-md ${itemSpacing}`}>
              {leftTeams.map((r, i) => renderTeam(r, i, 8))}
            </div>
          )}

          {/* Центральный столбец: 1-8 места (главный) */}
          <div className={`flex-1 max-w-2xl ${itemSpacing}`}>
            {centerTeams.map((r, i) => renderTeam(r, i, 0))}
          </div>

          {/* Правый столбец: 16-21 места — прижат снизу к уровню 8-го места */}
          {rightTeams.length > 0 && (
            <div className={`flex-1 max-w-md ${itemSpacing}`}>
              {rightTeams.map((r, i) => renderTeam(r, i, 8 + leftTeams.length))}
            </div>
          )}
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

  // Обычный режим (1-8 команд)
  const singleColumnSpacing = teamCount > 5 ? "space-y-4" : "space-y-6";
  const singleColumnPadding = teamCount > 5 ? "py-4 px-8" : "py-6 px-10";
  const singleNameSize = teamCount > 5 ? "text-4xl" : "text-6xl";
  const singleMedalSize = teamCount > 5 ? "text-6xl" : "text-8xl";
  const singleScoreSize = teamCount > 5 ? "text-3xl" : "text-5xl";

  return (
    <div className={`w-full h-full bg-gradient-to-b from-amber-900/95 to-stone-900 flex flex-col items-center justify-center py-8 px-16 text-white overflow-y-auto`}>
      <h1 className={`${titleSize} font-bold drop-shadow-lg flex-shrink-0`}>🏆 Итоги квиза</h1>
      <div className={`${singleColumnSpacing} w-full max-w-6xl flex-shrink-0`}>
        {results.map((r, i) => {
          const isVisible = visibleSet.has(i);
          if (!isVisible) {
            if (i === 0) {
              return (
                <div
                  key={r.teamId}
                  className={`flex items-center gap-6 ${singleColumnPadding} border-2 border-dashed border-amber-400/40 rounded-3xl ${singleNameSize} font-medium`}
                >
                  <span className={`w-24 ${singleMedalSize} text-center flex-shrink-0 opacity-40`}>
                    🥇
                  </span>
                  <span className="flex-1 opacity-30 tracking-widest">• • •</span>
                </div>
              );
            }
            return null;
          }
          return (
            <div
              key={r.teamId}
              className={`flex items-center gap-6 ${singleColumnPadding} bg-white/10 backdrop-blur rounded-3xl ${singleNameSize} font-medium`}
              style={{
                animation: "slideIn 0.5s ease-out forwards",
              }}
            >
              <span className={`w-24 ${singleMedalSize} text-center flex-shrink-0`}>
                {i < MEDALS.length ? MEDALS[i] : `${i + 1}.`}
              </span>
              <span className="flex-1 truncate">{r.name}</span>
              <span className={`text-amber-300 ${singleScoreSize} flex-shrink-0`}>
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
