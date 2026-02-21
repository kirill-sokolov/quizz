import { getMediaUrl } from "../../api/client";

export default function TVRules({ imageUrl }) {
  const imgSrc = imageUrl ? getMediaUrl(imageUrl) : "";

  return (
    <div className="absolute inset-0 w-full h-full bg-stone-900">
      {imgSrc ? (
        <img
          src={imgSrc}
          alt="Правила"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
      ) : (
        <div className="flex items-center justify-center h-full text-white text-4xl">
          Правила квиза
        </div>
      )}
    </div>
  );
}
