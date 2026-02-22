export default function TVLobby({ quiz, teams }) {
  const botUsername = "WeddingTest2Bot";
  const botUrl = `https://t.me/${botUsername}`;

  return (
    <div className="flex w-full h-full bg-stone-900 text-white">
      <div className="flex flex-col items-center justify-center flex-1 gap-8 p-16">
        <p className="text-5xl font-bold">Регистрация команд</p>

        <div className="flex flex-col items-center gap-6 bg-white p-12 rounded-3xl">
          {/* QR код - можно добавить библиотеку для генерации или использовать API */}
          <div className="w-64 h-64 bg-stone-200 flex items-center justify-center rounded-2xl">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(botUrl)}`}
              alt="QR код бота"
              className="w-full h-full"
            />
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-stone-900">@{botUsername}</p>
            <p className="text-lg text-stone-600 mt-2">Отсканируйте QR код</p>
          </div>
        </div>
      </div>

      {teams.length > 0 && (
        <div className="w-[400px] border-l border-stone-700 p-8 flex flex-col">
          <h3 className="text-2xl font-bold mb-6">Команды ({teams.length})</h3>
          <div className="flex-1 overflow-y-auto space-y-3">
            {teams.map((team, idx) => (
              <div key={team.id} className="bg-stone-800 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-amber-400">#{idx + 1}</span>
                  <span className="text-xl">{team.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
