import { useShallow } from 'zustand/react/shallow'
import type { Card as CardType } from '../types'
import { COLOR_CLASSES, STATUS_COLOR } from '../lib/colors'
import { formatDueDate, isDueToday, isOverdue } from '../lib/dates'
import { useSortableItem } from '../lib/useSortableItem'
import { selectAllTags, useBoardStore } from '../store/board'
import { AttachmentIcon, ChecklistIcon, InfoIcon, LinkIcon } from './icons'

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
  const tags = useBoardStore(useShallow(selectAllTags))
  const cardTags = tags.filter((t) => card.tagIds.includes(t.id))
  // Filed tasks aren't rendered in any column, so their status isn't visible
  // from placement alone — show it as a pill instead.
  const statusName = useBoardStore((s) => (card.folderId ? s.columns[card.columnId]?.name : undefined))

  const checklistTotal = card.checklist.length
  const checklistDone = card.checklist.filter((c) => c.done).length

  return (
    <>
      <p className="text-sm font-medium text-slate-100">{card.title}</p>

      {(statusName || card.priority || card.dueDate || cardTags.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {statusName && (
            <span
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${COLOR_CLASSES[STATUS_COLOR[statusName] ?? 'slate'].bgSoft} ${COLOR_CLASSES[STATUS_COLOR[statusName] ?? 'slate'].text}`}
            >
              {statusName}
            </span>
          )}
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
  const { attributes, listeners, setNodeRef, style } = useSortableItem(card.id, {
    columnId: card.columnId,
    folderId: card.folderId,
  })

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(card.id)}
      className="group cursor-grab rounded-xl border border-white/[0.07] bg-raised p-3.5 shadow-sm shadow-black/20 transition hover:border-white/[0.16] active:cursor-grabbing"
    >
      {/* float (not absolute) so wrapping title text flows around the icon
          instead of ever being able to sit underneath it */}
      <button
        type="button"
        aria-label="Task details"
        onClick={(e) => {
          e.stopPropagation()
          onOpen(card.id)
        }}
        className="icon-btn float-right mb-1 ml-2 opacity-0 transition group-hover:opacity-100"
      >
        <InfoIcon className="h-3.5 w-3.5" />
      </button>
      <CardBody card={card} />
    </div>
  )
}
