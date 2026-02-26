/**
 * SlideDndList — vertical sortable list for slide editing.
 * Base slides are non-draggable. Extra slides get a drag handle (⠿).
 * Content is rendered via renderItem(slide, idx) render prop.
 *
 * Props:
 *   slides: Array<slide>
 *   onReorder: (newSlides) => void
 *   renderItem: (slide, idx) => ReactNode
 */
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableItem({ id, isExtra, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isExtra });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
    position: "relative",
  };

  return (
    <div ref={setNodeRef} style={style}>
      {isExtra && (
        <div
          {...listeners}
          {...attributes}
          className="absolute left-0 top-0 bottom-0 w-7 flex items-center justify-center cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 z-10 select-none"
          title="Перетащить"
        >
          ⠿
        </div>
      )}
      <div className={isExtra ? "pl-7" : ""}>{children}</div>
    </div>
  );
}

export default function SlideDndList({ slides, onReorder, renderItem }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const ids = slides.map((_, i) => String(i));

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIdx = parseInt(active.id);
    const newIdx = parseInt(over.id);
    onReorder(arrayMove(slides, oldIdx, newIdx));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {slides.map((slide, idx) => (
          <SortableItem
            key={String(idx)}
            id={String(idx)}
            isExtra={slide.type === "extra"}
          >
            {renderItem(slide, idx)}
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  );
}
