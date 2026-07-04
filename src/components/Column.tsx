import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Column as ColumnType } from '../types'
import { COLOR_CLASSES } from '../lib/colors'
import { useBoardStore } from '../store/board'
import Card from './Card'

interface ColumnProps {
  column: ColumnType
  cards: import('../types').Card[]
  onOpenCard: (cardId: string) => void
}

export default function Column({ column, cards, onOpenCard }: ColumnProps) {
  const createCard = useBoardStore((s) => s.createCard)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const { setNodeRef: setDroppableRef } = useDroppable({ id: column.id, data: { type: 'column' } })
  const isNullspace = column.name === 'NULLSPACE'
  const colorClasses = COLOR_CLASSES[column.color as keyof typeof COLOR_CLASSES] ?? COLOR_CLASSES.slate

  function submitDraft() {
    const title = draft.trim()
    if (title) createCard(column.projectId, column.id, title)
    setDraft('')
  }

  return (
    <div
      className={
        isNullspace
          ? 'flex max-h-full w-[300px] shrink-0 flex-col rounded-2xl border border-dashed border-white/15 bg-white/[0.015]'
          : 'flex max-h-full w-[300px] shrink-0 flex-col rounded-2xl border border-white/[0.05] bg-white/[0.025]'
      }
    >
      <div className="flex items-center justify-between rounded-t-2xl px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${colorClasses.dot}`} />
          <span className={`truncate text-sm font-semibold ${isNullspace ? 'text-slate-500' : 'text-slate-200'}`}>
            {column.name}
          </span>
          <span className="rounded-full bg-white/[0.06] px-1.5 py-px text-[11px] font-medium text-slate-500">
            {cards.length}
          </span>
        </div>
      </div>

      <div ref={setDroppableRef} className="min-h-2 flex-1 space-y-2 overflow-y-auto px-2.5 pb-2">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <Card key={card.id} card={card} onOpen={onOpenCard} />
          ))}
        </SortableContext>
      </div>

      <div className="px-2.5 pt-1 pb-2.5">
        {adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submitDraft()
            }}
          >
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submitDraft()
                }
                if (e.key === 'Escape') {
                  setAdding(false)
                  setDraft('')
                }
              }}
              onBlur={() => {
                submitDraft()
                setAdding(false)
              }}
              rows={2}
              placeholder="Card title"
              className="input resize-none"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-300"
          >
            + Add card
          </button>
        )}
      </div>
    </div>
  )
}
