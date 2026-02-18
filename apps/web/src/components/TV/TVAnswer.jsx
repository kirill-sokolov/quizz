import TVSlideBg from "./TVSlideBg";

const LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function getSlideByType(slides, type) {
  if (!Array.isArray(slides)) return null;
  return slides.find((s) => s.type === type) ?? null;
}

export default function TVAnswer({ question, currentIndex, totalQuestions, slides }) {
  const slide = getSlideByType(slides, "answer");
  const options = question?.options ?? [];
  const correct = question?.correctAnswer ?? "";

  return (
    <TVSlideBg imageUrl={slide?.imageUrl} videoUrl={slide?.videoUrl}>
      <div className="absolute inset-0 flex flex-col justify-between p-16 text-white">
        <div className="text-3xl font-semibold text-white/90 drop-shadow-lg">
          Вопрос {currentIndex}/{totalQuestions} — ответ
        </div>
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-4xl font-bold text-center drop-shadow-lg max-w-4xl mx-auto mb-12">
            {question?.text || ""}
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            {options.slice(0, 8).map((opt, i) => {
              const letter = LABELS[i];
              const isCorrect = letter === correct;
              return (
                <div
                  key={i}
                  className={`px-8 py-4 rounded-2xl text-2xl font-medium ${
                    isCorrect
                      ? "bg-green-500/90 ring-4 ring-green-300"
                      : "bg-white/20 backdrop-blur"
                  }`}
                >
                  {letter}) {opt}
                  {isCorrect && " ✓"}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </TVSlideBg>
  );
}
