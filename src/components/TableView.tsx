import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { COLOR_CLASSES, PRIORITY_COLOR, STATUS_COLOR } from '../lib/colors'
import { formatDueDate, isDueToday, isOverdue } from '../lib/dates'
import { boardItemId, boardItemTitle, selectAllTags, useBoardStore } from '../store/board'
import type { BoardItem, Column, Priority } from '../types'

const PRIORITY_LABEL: Record<Priority, string> = { low: 'Low', med: 'Medium', high: 'High' }
const PRIORITY_RANK: Record<Priority, number> = { low: 0, med: 1, high: 2 }
const TYPE_LABEL: Record<BoardItem['kind'], string> = { task: 'Task', project: 'Project', folder: 'Folder' }

type SortKey = 'title' | 'priority' | 'dueDate' | 'status'

interface TableViewProps {
  items: BoardItem[]
  columns: Column[]
  showTypeColumn: boolean
  onOpenCard: (cardId: string) => void
  onMoveItem: (itemId: string, columnId: string) => void
}

export default function TableView({ items, columns, showTypeColumn, onOpenCard, onMoveItem }: TableViewProps) {
  const navigate = useNavigate()
  const tags = useBoardStore(useShallow(selectAllTags))
  const updateCard = useBoardStore((s) => s.updateCard)
  const [sortKey, setSortKey] = useState<SortKey>('status')
  const [sortDir, setSortDir] = useState<1 | -1>(1)

  const columnNameById = useMemo(() => new Map(columns.map((c) => [c.id, c.name])), [columns])
  const columnIndexById = useMemo(() => new Map(columns.map((c, i) => [c.id, i])), [columns])
  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 1 ? -1 : 1))
    } else {
      setSortKey(key)
      setSortDir(1)
    }
  }

  function priorityOf(item: BoardItem): Priority | undefined {
    return item.kind === 'task' ? item.card.priority : undefined
  }

  function dueDateOf(item: BoardItem): string | undefined {
    return item.kind === 'task' ? item.card.dueDate : undefined
  }

  function columnIdOf(item: BoardItem): string {
    return item.kind === 'task' ? item.card.columnId : item.kind === 'project' ? item.project.columnId : item.folder.columnId
  }

  function openItem(item: BoardItem) {
    if (item.kind === 'task') onOpenCard(item.card.id)
    else if (item.kind === 'project') navigate(`/project/${item.project.id}`)
    // Folders have no dedicated page anymore — they expand inline on the board view instead.
  }

  const sorted = useMemo(() => {
    const rows = [...items]
    rows.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'title':
          cmp = boardItemTitle(a).localeCompare(boardItemTitle(b))
          break
        case 'priority': {
          const pa = priorityOf(a)
          const pb = priorityOf(b)
          cmp = (pa ? PRIORITY_RANK[pa] : -1) - (pb ? PRIORITY_RANK[pb] : -1)
          break
        }
        case 'dueDate':
          cmp = (dueDateOf(a) ?? '').localeCompare(dueDateOf(b) ?? '')
          break
        case 'status':
          cmp = (columnIndexById.get(columnIdOf(a)) ?? 0) - (columnIndexById.get(columnIdOf(b)) ?? 0)
          break
      }
      return cmp * sortDir
    })
    return rows
  }, [items, sortKey, sortDir, columnIndexById])

  const colSpan = showTypeColumn ? 6 : 5

  return (
    <div className="flex-1 overflow-auto p-5">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <Th label="Title" active={sortKey === 'title'} dir={sortDir} onClick={() => toggleSort('title')} />
            {showTypeColumn && (
              <th className="border-b border-white/[0.06] px-3 py-2 text-left text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                Type
              </th>
            )}
            <th className="border-b border-white/[0.06] px-3 py-2 text-left text-[11px] font-medium tracking-wide text-slate-500 uppercase">
              Category
            </th>
            <Th label="Priority" active={sortKey === 'priority'} dir={sortDir} onClick={() => toggleSort('priority')} />
            <Th label="Due date" active={sortKey === 'dueDate'} dir={sortDir} onClick={() => toggleSort('dueDate')} />
            <Th label="Status" active={sortKey === 'status'} dir={sortDir} onClick={() => toggleSort('status')} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => {
            const id = boardItemId(item)
            const priority = priorityOf(item)
            const dueDate = dueDateOf(item)
            const columnId = columnIdOf(item)
            const tagIds = item.kind === 'task' ? item.card.tagIds : []
            return (
              <tr key={id} className="group">
                <td
                  onClick={item.kind !== 'folder' ? () => openItem(item) : undefined}
                  className={`border-b border-white/[0.04] px-3 py-2.5 text-slate-100 group-hover:bg-white/[0.02] ${
                    item.kind !== 'folder' ? 'cursor-pointer' : ''
                  }`}
                >
                  {boardItemTitle(item)}
                </td>
                {showTypeColumn && (
                  <td className="border-b border-white/[0.04] px-3 py-2.5 text-xs font-medium text-slate-400 group-hover:bg-white/[0.02]">
                    {TYPE_LABEL[item.kind]}
                  </td>
                )}
                <td className="border-b border-white/[0.04] px-3 py-2.5 group-hover:bg-white/[0.02]">
                  <div className="flex flex-wrap gap-1">
                    {tagIds.map((tagId) => {
                      const tag = tagById.get(tagId)
                      if (!tag) return null
                      const cls = COLOR_CLASSES[tag.color as keyof typeof COLOR_CLASSES] ?? COLOR_CLASSES.slate
                      return (
                        <span key={tagId} className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${cls.bgSoft} ${cls.text}`}>
                          {tag.name}
                        </span>
                      )
                    })}
                  </div>
                </td>
                <td className="border-b border-white/[0.04] px-3 py-2.5 group-hover:bg-white/[0.02]">
                  {item.kind === 'task' ? (
                    <div className="flex gap-1">
                      {(['low', 'med', 'high'] as Priority[]).map((p) => {
                        const cls = COLOR_CLASSES[PRIORITY_COLOR[p]]
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => updateCard(item.card.id, { priority: priority === p ? undefined : p })}
                            className={`rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition ${
                              priority === p
                                ? `${cls.bgSoft} ${cls.text} ${cls.border}`
                                : 'border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300'
                            }`}
                          >
                            {PRIORITY_LABEL[p]}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-600">—</span>
                  )}
                </td>
                <td className="border-b border-white/[0.04] px-3 py-2.5 group-hover:bg-white/[0.02]">
                  {item.kind === 'task' ? (
                    <>
                      <input
                        type="date"
                        value={dueDate ?? ''}
                        onChange={(e) => updateCard(item.card.id, { dueDate: e.target.value || undefined })}
                        className={`rounded-md border-none bg-transparent px-1 py-0.5 text-xs [color-scheme:dark] ${
                          dueDate && isOverdue(dueDate) ? 'text-rose-300' : dueDate && isDueToday(dueDate) ? 'text-amber-300' : 'text-slate-400'
                        }`}
                      />
                      {dueDate && <span className="ml-1.5 hidden text-[11px] text-slate-600 sm:inline">{formatDueDate(dueDate)}</span>}
                    </>
                  ) : (
                    <span className="text-xs text-slate-600">—</span>
                  )}
                </td>
                <td className="border-b border-white/[0.04] px-3 py-2.5 group-hover:bg-white/[0.02]">
                  <StatusSelect
                    value={columnId}
                    columns={columns}
                    columnNameById={columnNameById}
                    onChange={(colId) => onMoveItem(id, colId)}
                  />
                </td>
              </tr>
            )
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={colSpan} className="px-3 py-10 text-center text-sm text-slate-500">
                No items match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function StatusSelect({
  value,
  columns,
  columnNameById,
  onChange,
}: {
  value: string
  columns: Column[]
  columnNameById: Map<string, string>
  onChange: (columnId: string) => void
}) {
  const name = columnNameById.get(value) ?? ''
  const cls = COLOR_CLASSES[STATUS_COLOR[name] ?? 'slate']
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-md border px-1.5 py-1 text-xs font-medium ${cls.bgSoft} ${cls.text} ${cls.border}`}
    >
      {columns.map((c) => (
        <option key={c.id} value={c.id} className="bg-panel text-slate-200">
          {columnNameById.get(c.id)}
        </option>
      ))}
    </select>
  )
}

function Th({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: 1 | -1
  onClick: () => void
}) {
  return (
    <th className="border-b border-white/[0.06] px-3 py-2 text-left text-[11px] font-medium tracking-wide text-slate-500 uppercase">
      <button type="button" onClick={onClick} className={`flex items-center gap-1 transition hover:text-slate-300 ${active ? 'text-slate-300' : ''}`}>
        {label}
        {active && <span className="text-slate-500">{dir === 1 ? '↑' : '↓'}</span>}
      </button>
    </th>
  )
}
