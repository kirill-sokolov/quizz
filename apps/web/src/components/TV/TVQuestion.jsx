import TVSlideBg from "./TVSlideBg";
import { SLIDE_TYPES } from "../../constants/slides";

const LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function getSlideByType(slides, type) {
  if (!Array.isArray(slides)) return null;
  return slides.find((s) => s.type === type) ?? null;
}

export default function TVQuestion({ question, currentIndex, totalQuestions, slides }) {
  const slide = getSlideByType(slides, SLIDE_TYPES.QUESTION);
  const options = question?.options ?? [];

  return (
    <TVSlideBg imageUrl={slide?.imageUrl} videoUrl={slide?.videoUrl}>
      <div className="absolute inset-0 flex flex-col justify-between p-16 text-white">
        <div className="text-3xl font-semibold text-white/90 drop-shadow-lg">
          Вопрос {currentIndex}/{totalQuestions}
        </div>
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-5xl font-bold text-center drop-shadow-lg max-w-5xl mx-auto leading-tight">
            {question?.text || ""}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-6">
          {options.slice(0, 8).map((opt, i) => (
            <div
              key={i}
              className="px-8 py-4 bg-white/20 backdrop-blur rounded-2xl text-2xl font-medium"
            >
              {LABELS[i]}) {opt}
            </div>
          ))}
        </div>
      </div>
    </TVSlideBg>
  );
}
