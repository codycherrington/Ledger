import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { COLOR_CLASSES, COLOR_NAMES, type ColorName } from '../lib/colors'
import { selectAllTags, useBoardStore } from '../store/board'

interface TagPickerProps {
  activeTagIds: string[]
  onToggle: (tagId: string) => void
}

export default function TagPicker({ activeTagIds, onToggle }: TagPickerProps) {
  const tags = useBoardStore(useShallow(selectAllTags))
  const createTag = useBoardStore((s) => s.createTag)
  const deleteTag = useBoardStore((s) => s.deleteTag)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState<ColorName>('blue')

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => {
          const active = activeTagIds.includes(tag.id)
          const cls = COLOR_CLASSES[tag.color as ColorName] ?? COLOR_CLASSES.slate
          return (
            <span
              key={tag.id}
              className={`group inline-flex items-center rounded-full border transition ${
                active
                  ? `${cls.bgSoft} ${cls.text} ${cls.border}`
                  : 'border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300'
              }`}
            >
              <button
                type="button"
                onClick={() => onToggle(tag.id)}
                className="py-1 pr-1 pl-2.5 text-xs font-medium"
              >
                {tag.name}
              </button>
              {/* Tags are global now — deleting one affects every task/folder,
                  so it's tucked behind hover and a confirm rather than a plain click. */}
              <button
                type="button"
                aria-label={`Delete ${tag.name} tag`}
                onClick={() => {
                  if (window.confirm(`Delete the "${tag.name}" tag? It will be removed from everything using it.`)) deleteTag(tag.id)
                }}
                className="pr-2 pl-0.5 text-sm leading-none opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
              >
                ×
              </button>
            </span>
          )
        })}
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="rounded-full border border-dashed border-white/15 px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:border-white/30 hover:text-slate-300"
        >
          + New tag
        </button>
      </div>
      {adding && (
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tag name"
            className="input w-40 px-2.5 py-1.5"
          />
          <div className="flex gap-1.5">
            {COLOR_NAMES.slice(0, 8).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setColor(c)}
                className={`h-5 w-5 rounded-full transition ${COLOR_CLASSES[c].dot} ${
                  color === c ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-panel' : 'hover:scale-110'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              if (!name.trim()) return
              const id = createTag(name.trim(), color)
              onToggle(id)
              setName('')
              setAdding(false)
            }}
            className="btn-primary px-2.5 py-1.5 text-xs"
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}
