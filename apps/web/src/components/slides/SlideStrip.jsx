/**
 * SlideStrip — horizontal filmstrip with drag & drop for extra slides.
 * Base slides (question/timer/answer/video_*) are static.
 * Extra slides can be dragged to any position via 60px gap drop zones.
 *
 * Props:
 *   slides: Array<{ type: string, imageUrl: string | null }>
 *   onReorder: (newSlides) => void
 */
import { useState } from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { getMediaUrl } from "../../api/client";
import { SLIDE_LABELS } from "../../constants/slides";

function DropGap({ id, isDragging }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  if (!isDragging) {
    return <div className="w-1 shrink-0" />;
  }
  return (
    <div
      ref={setNodeRef}
      className={`shrink-0 h-20 rounded border-2 border-dashed transition-colors self-end
        ${isOver
          ? "w-16 min-w-[60px] bg-blue-100 border-blue-500"
          : "w-16 min-w-[60px] bg-stone-50 border-stone-300"
        }`}
    />
  );
}

function SlideThumb({ id, slide, isExtra, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id, disabled: !isExtra });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const label = isExtra
    ? "Экстра"
    : (SLIDE_LABELS[slide.type] || slide.type).replace("Слайд: ", "");

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`shrink-0 w-28 flex flex-col items-center gap-0.5 select-none
        ${isExtra ? "cursor-grab active:cursor-grabbing" : ""}
        ${isDragging ? "opacity-40" : ""}`}
      {...(isExtra ? { ...listeners, ...attributes } : {})}
    >
      <p className="text-xs text-stone-400 truncate max-w-full text-center px-1 leading-tight">
        {label}
      </p>
      <div className="relative">
        {slide.imageUrl ? (
          <img
            src={getMediaUrl(slide.imageUrl)}
            alt={slide.type}
            className={`w-28 h-20 object-cover rounded border
              ${isExtra ? "border-blue-300" : "border-stone-200"}`}
            draggable={false}
          />
        ) : (
          <div
            className={`w-28 h-20 rounded border flex items-center justify-center text-xs
              ${isExtra
                ? "border-blue-200 bg-blue-50 text-blue-400"
                : "border-stone-200 bg-stone-100 text-stone-400"
              }`}
          >
            Нет
          </div>
        )}
        {isExtra && onDelete && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center leading-none shadow"
            title="Удалить"
          >
            ✕
          </button>
        )}
      </div>
      {isExtra && (
        <p className="text-[10px] text-blue-400 leading-tight">↔ тянуть</p>
      )}
    </div>
  );
}

export default function SlideStrip({ slides, onReorder, onDelete }) {
  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const isDragging = activeId !== null;
  const activeSlide = isDragging ? slides[parseInt(activeId)] : null;

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over) return;
    const oldIdx = parseInt(active.id);
    let insertAt = parseInt(over.id.replace("gap-", ""));
    const newSlides = [...slides];
    const [moved] = newSlides.splice(oldIdx, 1);
    if (oldIdx < insertAt) insertAt--;
    newSlides.splice(insertAt, 0, moved);
    onReorder(newSlides);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex items-end overflow-x-auto pb-2 gap-0">
        {slides.flatMap((slide, idx) => [
          <DropGap key={`gap-${idx}`} id={`gap-${idx}`} isDragging={isDragging} />,
          <SlideThumb
            key={`slide-${idx}`}
            id={String(idx)}
            slide={slide}
            isExtra={slide.type === "extra"}
            onDelete={slide.type === "extra" && onDelete ? () => onDelete(idx) : undefined}
          />,
        ])}
        <DropGap
          key={`gap-${slides.length}`}
          id={`gap-${slides.length}`}
          isDragging={isDragging}
        />
      </div>

      <DragOverlay>
        {activeSlide ? (
          <div className="rotate-2 shadow-xl opacity-90">
            {activeSlide.imageUrl ? (
              <img
                src={getMediaUrl(activeSlide.imageUrl)}
                alt="drag"
                className="w-28 h-20 object-cover rounded border-2 border-blue-400"
              />
            ) : (
              <div className="w-28 h-20 bg-blue-50 rounded border-2 border-blue-400 flex items-center justify-center text-xs text-blue-500">
                Экстра
              </div>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
