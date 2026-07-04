import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export function useSortableItem(id: string, data?: Record<string, unknown>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: 'item', ...data },
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return { attributes, listeners, setNodeRef, style, isDragging }
}
