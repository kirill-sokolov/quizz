import TVSlideBg from "./TVSlideBg";
import { SLIDE_TYPES } from "../../constants/slides";

function getSlideByType(slides, type) {
  if (!Array.isArray(slides)) return null;
  return slides.find((s) => s.type === type) ?? null;
}

export default function TVVideoIntro({ currentIndex, totalQuestions, slides }) {
  const slide = getSlideByType(slides, SLIDE_TYPES.VIDEO_INTRO);

  return (
    <TVSlideBg imageUrl={slide?.imageUrl} videoUrl={slide?.videoUrl}>
      <div className="absolute top-0 left-0 right-0 p-8 text-white">
        <div className="text-3xl font-semibold text-white/90 drop-shadow-lg">
          Вопрос {currentIndex}/{totalQuestions} — видео
        </div>
      </div>
    </TVSlideBg>
  );
}
