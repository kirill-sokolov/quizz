import { getMediaUrl } from "../../api/client";

export default function TVExtraSlide({ slide }) {
  if (!slide) return null;

  const imgSrc = slide.imageUrl ? getMediaUrl(slide.imageUrl) : null;
  const videoSrc = slide.videoUrl ? getMediaUrl(slide.videoUrl) : null;

  return (
    <div className="absolute inset-0 w-full h-full bg-black">
      {imgSrc && (
        <img
          src={imgSrc}
          alt="Extra"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
      )}
      {videoSrc && (
        <video
          key={videoSrc}
          src={videoSrc}
          autoPlay
          loop
          muted={false}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {!imgSrc && !videoSrc && (
        <div className="flex items-center justify-center h-full text-white text-4xl">
          Экстра-слайд
        </div>
      )}
    </div>
  );
}
