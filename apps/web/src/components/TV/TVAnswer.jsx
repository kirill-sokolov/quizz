import TVSlideBg from "./TVSlideBg";
import { SLIDE_TYPES } from "../../constants/slides";

function getSlideByType(slides, type) {
  if (!Array.isArray(slides)) return null;
  return slides.find((s) => s.type === type) ?? null;
}

export default function TVAnswer({ question, currentIndex, totalQuestions, slides }) {
  const slide = getSlideByType(slides, SLIDE_TYPES.ANSWER);

  return <TVSlideBg imageUrl={slide?.imageUrl} videoUrl={slide?.videoUrl} videoLayout={slide?.videoLayout ?? slide?.video_layout} />;
}
