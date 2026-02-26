/**
 * SlideStrip — horizontal filmstrip with two zones:
 *   1. Main strip: base slides (question/timer/answer/video_*) + explicitly placed extras
 *   2. Extras pool: unplaced extras to drag into the strip
 *
 * Props:
 *   orderedSlides: Array<{ type, imageUrl }> — base + placed extras (saved)
 *   unusedExtras:  Array<{ type, imageUrl }> — pool of unplaced extras (discarded on save)
 *   onReorder:     (newOrderedSlides) => void — reorder placed extras within strip
 *   onPlaceExtra:  (poolIdx, insertAt) => void — move extra from pool into strip
 *   onDeletePlaced:(slideIdx) => void — remove placed extra from strip
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
  if (!isDragging) return <div className="w-1 shrink-0" />;
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

function SlideThumb({ id, slide, isExtra, isDraggable, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id, disabled: !isDraggable });

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
        ${isDraggable ? "cursor-grab active:cursor-grabbing" : ""}
        ${isDragging ? "opacity-40" : ""}`}
      {...(isDraggable ? { ...listeners, ...attributes } : {})}
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
        {onDelete && (
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
      {isDraggable && (
        <p className="text-[10px] text-blue-400 leading-tight">↔ тянуть</p>
      )}
    </div>
  );
}

export default function SlideStrip({
  orderedSlides,
  unusedExtras = [],
  onReorder,
  onPlaceExtra,
  onDeletePlaced,
}) {
  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const isDragging = activeId !== null;

  let activeSlide = null;
  if (activeId?.startsWith("pool-")) {
    activeSlide = unusedExtras[parseInt(activeId.replace("pool-", ""))];
  } else if (activeId?.startsWith("strip-")) {
    activeSlide = orderedSlides[parseInt(activeId.replace("strip-", ""))];
  }

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over) return;

    const insertAt = parseInt(over.id.replace("gap-", ""));

    if (active.id.startsWith("pool-")) {
      // Move from pool into the main strip
      const poolIdx = parseInt(active.id.replace("pool-", ""));
      onPlaceExtra(poolIdx, insertAt);
    } else if (active.id.startsWith("strip-")) {
      // Reorder placed extra within the strip
      const oldIdx = parseInt(active.id.replace("strip-", ""));
      let at = insertAt;
      const newSlides = [...orderedSlides];
      const [moved] = newSlides.splice(oldIdx, 1);
      if (oldIdx < at) at--;
      newSlides.splice(at, 0, moved);
      onReorder(newSlides);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {/* Main strip: base slides + placed extras */}
      <div className="flex items-end overflow-x-auto pb-2 gap-0">
        {orderedSlides.flatMap((slide, idx) => [
          <DropGap key={`gap-${idx}`} id={`gap-${idx}`} isDragging={isDragging} />,
          <SlideThumb
            key={`strip-${idx}`}
            id={`strip-${idx}`}
            slide={slide}
            isExtra={slide.type === "extra"}
            isDraggable={slide.type === "extra"}
            onDelete={
              slide.type === "extra" && onDeletePlaced
                ? () => onDeletePlaced(idx)
                : undefined
            }
          />,
        ])}
        <DropGap
          key={`gap-${orderedSlides.length}`}
          id={`gap-${orderedSlides.length}`}
          isDragging={isDragging}
        />
      </div>

      {/* Extras pool: unplaced extras (draggable into the strip above) */}
      {unusedExtras.length > 0 && (
        <div className="mt-2 pt-2 border-t border-stone-100">
          <p className="text-xs text-stone-400 mb-1">
            Экстра-слайды — перетащи нужный в ленту выше, остальные при сохранении удалятся:
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {unusedExtras.map((slide, idx) => (
              <SlideThumb
                key={`pool-${idx}`}
                id={`pool-${idx}`}
                slide={slide}
                isExtra={true}
                isDraggable={true}
              />
            ))}
          </div>
        </div>
      )}

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
