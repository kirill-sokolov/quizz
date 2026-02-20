import TVSlideBg from "./TVSlideBg";

function getSlideByType(slides, type) {
  if (!Array.isArray(slides)) return null;
  return slides.find((s) => s.type === type) ?? null;
}

export default function TVVideoWarning({ currentIndex, totalQuestions, slides }) {
  const slide = getSlideByType(slides, "video_warning");

  return (
    <TVSlideBg imageUrl={slide?.imageUrl}>
      <div className="absolute inset-0 flex flex-col items-center justify-center p-16 text-white">
        <div className="text-3xl font-semibold text-white/90 drop-shadow-lg mb-8">
          Вопрос {currentIndex}/{totalQuestions}
        </div>
        <div className="flex flex-col items-center gap-8">
          <div className="text-8xl">🎬</div>
          <p className="text-5xl font-bold text-center drop-shadow-lg">
            Видео-вопрос
          </p>
          <p className="text-3xl text-center text-white/80 max-w-3xl">
            Внимание! Следующий вопрос содержит видео
          </p>
        </div>
      </div>
    </TVSlideBg>
  );
}
