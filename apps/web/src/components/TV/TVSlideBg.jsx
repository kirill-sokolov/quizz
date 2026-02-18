import { getMediaUrl } from "../../api/client";

/** Фон слайда: картинка строго на весь экран + опционально YouTube поверх */
export default function TVSlideBg({ imageUrl, videoUrl, children }) {
  const imgSrc = imageUrl ? getMediaUrl(imageUrl) : "";
  const embedUrl = videoUrl
    ? (() => {
        try {
          const u = new URL(videoUrl);
          if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
            return `https://www.youtube.com/embed/${u.searchParams.get("v")}?autoplay=0`;
          }
          if (u.hostname.includes("youtu.be")) {
            return `https://www.youtube.com/embed/${u.pathname.slice(1)}?autoplay=0`;
          }
        } catch (_) {}
        return null;
      })()
    : null;

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
      {embedUrl && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
          <iframe
            title="YouTube"
            src={embedUrl}
            className="w-full max-w-4xl aspect-video border-0 pointer-events-auto"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
      {children}
    </div>
  );
}
