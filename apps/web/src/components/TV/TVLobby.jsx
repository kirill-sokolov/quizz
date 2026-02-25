export default function TVLobby({ quiz, teams }) {
  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;
  const botUrl = `https://t.me/${botUsername}`;

  return (
    <div className="flex w-full h-full bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 text-white">
      {/* Левая часть: QR код */}
      <div className="flex flex-col items-center justify-center flex-1 gap-8 p-12">
        <h1 className="text-5xl font-bold text-center">
          Регистрация команд
        </h1>

        <div className="flex flex-col items-center gap-6 bg-white p-12 rounded-3xl shadow-2xl max-w-full max-h-[85vh]">
          {/* QR код — адаптивный размер */}
          <div className="w-full max-w-[600px] aspect-square bg-white flex items-center justify-center rounded-2xl">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(botUrl)}`}
              alt="QR код бота"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="text-center">
            <p className="text-3xl font-bold text-stone-900 mb-2">@{botUsername}</p>
            <p className="text-xl text-stone-600">Отсканируйте QR код</p>
          </div>
        </div>
      </div>

      {/* Правая часть: список команд */}
      {teams.length > 0 && (
        <div className="w-[500px] border-l-4 border-amber-500 bg-stone-800/50 backdrop-blur p-12 flex flex-col">
          <h3 className="text-4xl font-bold mb-8 text-amber-400">
            Зарегистрировано: {teams.length}
          </h3>
          <div className="flex-1 overflow-y-auto space-y-4">
            {teams.map((team) => (
              <div
                key={team.id}
                className="bg-gradient-to-r from-stone-700 to-stone-800 rounded-xl p-6 shadow-lg border-l-4 border-amber-400 transform transition-all hover:scale-105"
              >
                <div className="flex items-center gap-4">
                  {/* Иконка команды */}
                  <div className="w-12 h-12 rounded-full bg-amber-400 flex items-center justify-center text-stone-900 font-bold text-xl flex-shrink-0">
                    {team.name[0].toUpperCase()}
                  </div>
                  {/* Название команды */}
                  <span className="text-2xl font-medium">{team.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
