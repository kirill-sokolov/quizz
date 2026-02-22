import { useState, useRef, useCallback, useEffect } from "react";
import { getMediaUrl } from "../api/client";

const MIN_SIZE = 5; // minimum 5% width/height
const DEFAULT_LAYOUT = { top: 10, left: 10, width: 80, height: 80 };

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

export default function VideoLayoutEditor({ imageUrl, videoUrl, videoLayout, onChange }) {
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(null); // { mode, startX, startY, startLayout }

  const layout = videoLayout || null;
  const imgSrc = imageUrl ? getMediaUrl(imageUrl) : "";
  const videoSrc = videoUrl ? getMediaUrl(videoUrl) : null;

  const toPercent = useCallback((px, dimension) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return (px / (dimension === "x" ? rect.width : rect.height)) * 100;
  }, []);

  const handleMouseDown = useCallback((e, mode) => {
    e.preventDefault();
    e.stopPropagation();
    if (!layout) return;
    setDragging({
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startLayout: { ...layout },
    });
  }, [layout]);

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const dx = ((e.clientX - dragging.startX) / rect.width) * 100;
      const dy = ((e.clientY - dragging.startY) / rect.height) * 100;
      const s = dragging.startLayout;
      let next = { ...s };

      switch (dragging.mode) {
        case "move": {
          next.left = clamp(s.left + dx, 0, 100 - s.width);
          next.top = clamp(s.top + dy, 0, 100 - s.height);
          break;
        }
        // Corner handles — proportional resize
        case "corner-tl": {
          const delta = Math.max(dx, dy);
          const newW = clamp(s.width - delta, MIN_SIZE, s.left + s.width);
          const scale = newW / s.width;
          const newH = Math.max(MIN_SIZE, s.height * scale);
          next = {
            left: s.left + s.width - newW,
            top: s.top + s.height - newH,
            width: newW,
            height: newH,
          };
          break;
        }
        case "corner-tr": {
          const delta = Math.max(-dx, dy);
          const newW = clamp(s.width - delta, MIN_SIZE, 100 - s.left);
          const scale = newW / s.width;
          const newH = Math.max(MIN_SIZE, s.height * scale);
          next = {
            left: s.left,
            top: s.top + s.height - newH,
            width: newW,
            height: newH,
          };
          break;
        }
        case "corner-bl": {
          const delta = Math.max(dx, -dy);
          const newW = clamp(s.width - delta, MIN_SIZE, s.left + s.width);
          const scale = newW / s.width;
          const newH = Math.max(MIN_SIZE, s.height * scale);
          next = {
            left: s.left + s.width - newW,
            top: s.top,
            width: newW,
            height: newH,
          };
          break;
        }
        case "corner-br": {
          const delta = Math.max(-dx, -dy);
          const newW = clamp(s.width - delta, MIN_SIZE, 100 - s.left);
          const scale = newW / s.width;
          const newH = Math.max(MIN_SIZE, s.height * scale);
          next = {
            left: s.left,
            top: s.top,
            width: newW,
            height: newH,
          };
          break;
        }
        // Edge handles — crop (change one dimension)
        case "edge-top": {
          const newTop = clamp(s.top + dy, 0, s.top + s.height - MIN_SIZE);
          next.top = newTop;
          next.height = s.top + s.height - newTop;
          break;
        }
        case "edge-bottom": {
          next.height = clamp(s.height + dy, MIN_SIZE, 100 - s.top);
          break;
        }
        case "edge-left": {
          const newLeft = clamp(s.left + dx, 0, s.left + s.width - MIN_SIZE);
          next.left = newLeft;
          next.width = s.left + s.width - newLeft;
          break;
        }
        case "edge-right": {
          next.width = clamp(s.width + dx, MIN_SIZE, 100 - s.left);
          break;
        }
      }

      // Clamp all values to valid range
      next.top = clamp(next.top, 0, 100 - MIN_SIZE);
      next.left = clamp(next.left, 0, 100 - MIN_SIZE);
      next.width = clamp(next.width, MIN_SIZE, 100 - next.left);
      next.height = clamp(next.height, MIN_SIZE, 100 - next.top);

      // Round to 1 decimal
      next.top = Math.round(next.top * 10) / 10;
      next.left = Math.round(next.left * 10) / 10;
      next.width = Math.round(next.width * 10) / 10;
      next.height = Math.round(next.height * 10) / 10;

      onChange(next);
    };

    const handleMouseUp = () => {
      setDragging(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, onChange]);

  const handleInit = () => {
    onChange({ ...DEFAULT_LAYOUT });
  };

  const handleReset = () => {
    onChange(null);
  };

  const handleSize = 10;
  const edgeThickness = 6;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {!layout ? (
          <button
            type="button"
            onClick={handleInit}
            className="text-sm px-3 py-1 bg-amber-100 text-amber-800 rounded hover:bg-amber-200 transition"
          >
            Настроить позицию видео
          </button>
        ) : (
          <button
            type="button"
            onClick={handleReset}
            className="text-sm px-3 py-1 bg-stone-100 text-stone-600 rounded hover:bg-stone-200 transition"
          >
            Сбросить позицию
          </button>
        )}
      </div>

      {layout && (
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden bg-stone-900 select-none"
          style={{ aspectRatio: "16/9", outline: "1px solid #d6d3d1" }}
        >
          {/* Background image */}
          {imgSrc && (
            <img
              src={imgSrc}
              alt=""
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              draggable={false}
            />
          )}

          {/* Video rectangle */}
          <div
            className="absolute cursor-move"
            style={{
              top: `${layout.top}%`,
              left: `${layout.left}%`,
              width: `${layout.width}%`,
              height: `${layout.height}%`,
              outline: "2px solid #fbbf24",
              outlineOffset: "0px",
            }}
            onMouseDown={(e) => handleMouseDown(e, "move")}
          >
            {/* Video or placeholder inside */}
            <div className="w-full h-full overflow-hidden">
              {videoSrc ? (
                <video
                  src={videoSrc}
                  className="w-full h-full pointer-events-none"
                  style={{ objectFit: "cover" }}
                  muted
                />
              ) : (
                <div className="w-full h-full bg-black/40 flex items-center justify-center">
                  <span className="text-white/60 text-xs">Видео</span>
                </div>
              )}
            </div>

            {/* Corner handles — proportional resize */}
            {["tl", "tr", "bl", "br"].map((corner) => {
              const isTop = corner.includes("t");
              const isLeft = corner.includes("l");
              return (
                <div
                  key={corner}
                  className="absolute w-3 h-3 bg-amber-400 border border-amber-600 rounded-sm"
                  style={{
                    top: isTop ? -handleSize / 2 : "auto",
                    bottom: !isTop ? -handleSize / 2 : "auto",
                    left: isLeft ? -handleSize / 2 : "auto",
                    right: !isLeft ? -handleSize / 2 : "auto",
                    cursor:
                      corner === "tl" || corner === "br"
                        ? "nwse-resize"
                        : "nesw-resize",
                    width: handleSize,
                    height: handleSize,
                    zIndex: 10,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, `corner-${corner}`)}
                />
              );
            })}

            {/* Edge handles — crop resize */}
            {/* Top edge */}
            <div
              className="absolute left-1/2 -translate-x-1/2 bg-amber-400/60 rounded-sm hover:bg-amber-400"
              style={{
                top: -edgeThickness / 2,
                width: "30%",
                height: edgeThickness,
                cursor: "ns-resize",
                zIndex: 9,
              }}
              onMouseDown={(e) => handleMouseDown(e, "edge-top")}
            />
            {/* Bottom edge */}
            <div
              className="absolute left-1/2 -translate-x-1/2 bg-amber-400/60 rounded-sm hover:bg-amber-400"
              style={{
                bottom: -edgeThickness / 2,
                width: "30%",
                height: edgeThickness,
                cursor: "ns-resize",
                zIndex: 9,
              }}
              onMouseDown={(e) => handleMouseDown(e, "edge-bottom")}
            />
            {/* Left edge */}
            <div
              className="absolute top-1/2 -translate-y-1/2 bg-amber-400/60 rounded-sm hover:bg-amber-400"
              style={{
                left: -edgeThickness / 2,
                height: "30%",
                width: edgeThickness,
                cursor: "ew-resize",
                zIndex: 9,
              }}
              onMouseDown={(e) => handleMouseDown(e, "edge-left")}
            />
            {/* Right edge */}
            <div
              className="absolute top-1/2 -translate-y-1/2 bg-amber-400/60 rounded-sm hover:bg-amber-400"
              style={{
                right: -edgeThickness / 2,
                height: "30%",
                width: edgeThickness,
                cursor: "ew-resize",
                zIndex: 9,
              }}
              onMouseDown={(e) => handleMouseDown(e, "edge-right")}
            />
          </div>
        </div>
      )}
    </div>
  );
}
