import { useShallow } from 'zustand/react/shallow'
import { COLOR_CLASSES } from '../lib/colors'
import { selectProjectTags, useBoardStore } from '../store/board'
import type { Priority } from '../types'

interface FilterBarProps {
  projectId: string
  search: string
  onSearchChange: (v: string) => void
  priority: Priority | null
  onPriorityChange: (p: Priority | null) => void
  tagIds: string[]
  onTagIdsChange: (ids: string[]) => void
}

const PRIORITIES: Priority[] = ['low', 'med', 'high']
const PRIORITY_LABEL: Record<Priority, string> = { low: 'Low', med: 'Medium', high: 'High' }

export default function FilterBar({
  projectId,
  search,
  onSearchChange,
  priority,
  onPriorityChange,
  tagIds,
  onTagIdsChange,
}: FilterBarProps) {
  const tags = useBoardStore(useShallow((s) => selectProjectTags(s, projectId)))

  function toggleTag(id: string) {
    onTagIdsChange(tagIds.includes(id) ? tagIds.filter((t) => t !== id) : [...tagIds, id])
  }

  const hasFilters = search.length > 0 || priority !== null || tagIds.length > 0

  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-white/[0.06] px-5 py-2.5">
      <input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search cards…"
        className="input w-56 px-2.5 py-1.5"
      />
      <div className="flex gap-1">
        {PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPriorityChange(priority === p ? null : p)}
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
              priority === p
                ? 'border-indigo-400/40 bg-indigo-500/20 text-indigo-300'
                : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300'
            }`}
          >
            {PRIORITY_LABEL[p]}
          </button>
        ))}
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => {
            const active = tagIds.includes(tag.id)
            const cls = COLOR_CLASSES[tag.color as keyof typeof COLOR_CLASSES] ?? COLOR_CLASSES.slate
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  active
                    ? `${cls.bgSoft} ${cls.text} ${cls.border}`
                    : 'border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300'
                }`}
              >
                {tag.name}
              </button>
            )
          })}
        </div>
      )}
      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            onSearchChange('')
            onPriorityChange(null)
            onTagIdsChange([])
          }}
          className="text-xs font-medium text-slate-500 transition hover:text-slate-300"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
