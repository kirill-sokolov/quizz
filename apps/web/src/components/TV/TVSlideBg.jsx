import { useRef, useEffect } from "react";
import { getMediaUrl } from "../../api/client";

/** Фон слайда: картинка строго на весь экран + опционально mp4 видео поверх */
export default function TVSlideBg({ imageUrl, videoUrl, children }) {
  const imgSrc = imageUrl ? getMediaUrl(imageUrl) : "";
  const videoSrc = videoUrl ? getMediaUrl(videoUrl) : null;
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current || !videoSrc) return;

    // Автоплей при монтировании
    const playPromise = videoRef.current.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay заблокирован браузером - ничего не делаем
      });
    }

    // Автостоп при размонтировании
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
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
            className="absolute inset-0 w-full h-full min-w-full min-h-full object-cover object-center"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-stone-800" />
        )}
      </div>
      {videoSrc && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <video
            ref={videoRef}
            src={videoSrc}
            controls
            className="w-full max-w-4xl aspect-video"
            style={{ maxHeight: "80vh" }}
          />
        </div>
      )}
      {children}
    </div>
  );
}
