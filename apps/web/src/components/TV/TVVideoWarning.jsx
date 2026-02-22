import TVSlideBg from "./TVSlideBg";
import { SLIDE_TYPES } from "../../constants/slides";

function getSlideByType(slides, type) {
  if (!Array.isArray(slides)) return null;
  return slides.find((s) => s.type === type) ?? null;
}

export default function TVVideoWarning({ currentIndex, totalQuestions, slides }) {
  const slide = getSlideByType(slides, SLIDE_TYPES.VIDEO_WARNING);

  return <TVSlideBg imageUrl={slide?.imageUrl} />;
}
