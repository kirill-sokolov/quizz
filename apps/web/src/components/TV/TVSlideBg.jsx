import { useRef, useEffect } from "react";
import { getMediaUrl } from "../../api/client";

/** Фон слайда: картинка строго на весь экран + опционально mp4 видео поверх */
export default function TVSlideBg({ imageUrl, videoUrl, videoLayout, children }) {
  const imgSrc = imageUrl ? getMediaUrl(imageUrl) : "";
  const videoSrc = videoUrl ? getMediaUrl(videoUrl) : null;
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    // Сбросить состояние и запустить воспроизведение
    video.currentTime = 0;
    video.load();

    // Попытка автоплея после загрузки метаданных
    const tryPlay = () => {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay заблокирован браузером
          console.warn("Video autoplay blocked");
        });
      }
    };

    // Подписываемся на событие загрузки
    video.addEventListener("loadeddata", tryPlay);

    // Пытаемся сразу, если уже загружено
    if (video.readyState >= 2) {
      tryPlay();
    }

    // Автостоп при размонтировании
    return () => {
      video.removeEventListener("loadeddata", tryPlay);
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
    };
  }, [videoSrc]);

  return (
    <div className="absolute inset-0 w-full h-full min-w-full min-h-full bg-stone-900">
      {/* Картинка всегда на весь экран: слой на весь контейнер, object-cover */}
      <div className="absolute inset-0 w-full h-full">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt=""
            className="absolute inset-0 w-full h-full object-contain object-center"
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-stone-800" />
        )}
      </div>
      {videoSrc && (
        videoLayout ? (
          <div
            className="absolute overflow-hidden"
            style={{
              top: `${videoLayout.top}%`,
              left: `${videoLayout.left}%`,
              width: `${videoLayout.width}%`,
              height: `${videoLayout.height}%`,
            }}
          >
            <video
              ref={videoRef}
              src={videoSrc}
              autoPlay
              controls
              className="w-full h-full"
              style={{ objectFit: "cover" }}
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <video
              ref={videoRef}
              src={videoSrc}
              autoPlay
              controls
              className="w-full max-w-4xl aspect-video"
              style={{ maxHeight: "80vh" }}
            />
          </div>
        )
      )}
      {children}
    </div>
  );
}
