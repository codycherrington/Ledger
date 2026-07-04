import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useShallow } from 'zustand/react/shallow'
import type { Card as CardType } from '../types'
import { COLOR_CLASSES } from '../lib/colors'
import { formatDueDate, isDueToday, isOverdue } from '../lib/dates'
import { selectProjectTags, useBoardStore } from '../store/board'
import { AttachmentIcon, ChecklistIcon, LinkIcon } from './icons'

const PRIORITY_CLASSES: Record<NonNullable<CardType['priority']>, string> = {
  low: 'bg-white/[0.06] text-slate-400',
  med: 'bg-amber-400/10 text-amber-300',
  high: 'bg-rose-400/10 text-rose-300',
}

const PRIORITY_LABEL: Record<NonNullable<CardType['priority']>, string> = {
  low: 'Low',
  med: 'Medium',
  high: 'High',
}

export function CardBody({ card }: { card: CardType }) {
  const tags = useBoardStore(useShallow((s) => selectProjectTags(s, card.projectId)))
  const cardTags = tags.filter((t) => card.tagIds.includes(t.id))

  const checklistTotal = card.checklist.length
  const checklistDone = card.checklist.filter((c) => c.done).length

  return (
    <>
      <p className="text-sm font-medium text-slate-100">{card.title}</p>

      {(card.priority || card.dueDate || cardTags.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.priority && (
            <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${PRIORITY_CLASSES[card.priority]}`}>
              {PRIORITY_LABEL[card.priority]}
            </span>
          )}
          {card.dueDate && (
            <span
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                isOverdue(card.dueDate)
                  ? 'bg-rose-400/10 text-rose-300'
                  : isDueToday(card.dueDate)
                    ? 'bg-amber-400/10 text-amber-300'
                    : 'bg-white/[0.06] text-slate-400'
              }`}
            >
              {formatDueDate(card.dueDate)}
            </span>
          )}
          {cardTags.map((tag) => {
            const cls = COLOR_CLASSES[tag.color as keyof typeof COLOR_CLASSES] ?? COLOR_CLASSES.slate
            return (
              <span
                key={tag.id}
                className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${cls.bgSoft} ${cls.text}`}
              >
                {tag.name}
              </span>
            )
          })}
        </div>
      )}

      {(checklistTotal > 0 || card.attachments.length > 0 || card.links.length > 0) && (
        <div className="mt-2.5 flex items-center gap-3 text-[11px] text-slate-500">
          {checklistTotal > 0 && (
            <span className={`flex items-center gap-1 ${checklistDone === checklistTotal ? 'text-emerald-400' : ''}`}>
              <ChecklistIcon />
              {checklistDone}/{checklistTotal}
            </span>
          )}
          {card.attachments.length > 0 && (
            <span className="flex items-center gap-1">
              <AttachmentIcon />
              {card.attachments.length}
            </span>
          )}
          {card.links.length > 0 && (
            <span className="flex items-center gap-1">
              <LinkIcon />
              {card.links.length}
            </span>
          )}
        </div>
      )}
    </>
  )
}

interface CardProps {
  card: CardType
  onOpen: (cardId: string) => void
}

export default function Card({ card, onOpen }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', columnId: card.columnId },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(card.id)}
      className="cursor-grab rounded-xl border border-white/[0.07] bg-raised p-3.5 shadow-sm shadow-black/20 transition hover:border-white/[0.16] active:cursor-grabbing"
    >
      <CardBody card={card} />
    </div>
  )
}
