import * as Popover from '@radix-ui/react-popover'
import { useState } from 'react'
import { COLOR_CLASSES, COLOR_NAMES } from '../lib/colors'
import type { Column } from '../types'
import { useBoardStore } from '../store/board'
import { MoreIcon } from './icons'

interface ColumnEditPopoverProps {
  column: Column
  cardCount: number
}

export default function ColumnEditPopover({ column, cardCount }: ColumnEditPopoverProps) {
  const updateColumn = useBoardStore((s) => s.updateColumn)
  const deleteColumn = useBoardStore((s) => s.deleteColumn)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(column.name)

  function handleDelete() {
    const message =
      cardCount > 0
        ? `Delete "${column.name}" and its ${cardCount} card${cardCount === 1 ? '' : 's'}?`
        : `Delete "${column.name}"?`
    if (window.confirm(message)) {
      deleteColumn(column.id)
    }
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setName(column.name)
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Edit phase"
          onPointerDown={(e) => e.stopPropagation()}
          className="icon-btn"
        >
          <MoreIcon />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          onPointerDown={(e) => e.stopPropagation()}
          className="animate-pop-in bg-overlay z-50 w-64 rounded-xl border border-white/10 p-3.5 shadow-xl shadow-black/40"
        >
          <label className="block text-[11px] font-medium tracking-wide text-slate-500 uppercase">
            Phase name
          </label>
          <div className="mt-1.5 flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className="input px-2.5 py-1.5" />
            <button
              type="button"
              onClick={() => {
                if (name.trim()) updateColumn(column.id, { name: name.trim() })
              }}
              className="btn-primary px-2.5 py-1.5 text-xs"
            >
              Save
            </button>
          </div>

          <label className="mt-4 block text-[11px] font-medium tracking-wide text-slate-500 uppercase">
            Color
          </label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {COLOR_NAMES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => updateColumn(column.id, { color: c })}
                className={`h-5 w-5 rounded-full transition ${COLOR_CLASSES[c].dot} ${
                  column.color === c ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-overlay' : 'hover:scale-110'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleDelete}
            className="mt-4 w-full rounded-lg border border-rose-400/20 px-2.5 py-1.5 text-xs font-medium text-rose-400 transition hover:border-rose-400/40 hover:bg-rose-400/10"
          >
            Delete phase
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
