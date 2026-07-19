import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { COLOR_CLASSES, PRIORITY_COLOR, STATUS_COLOR } from '../lib/colors'
import { formatDueDate, isDueToday, isOverdue } from '../lib/dates'
import { PRIORITY_RANK, boardItemId, boardItemTitle, selectAllTags, sortFolderTasksForDisplay, useBoardStore } from '../store/board'
import { ChevronIcon } from './icons'
import type { BoardItem, Card, Column, Priority } from '../types'

const PRIORITY_LABEL: Record<Priority, string> = { low: 'Low', med: 'Medium', high: 'High' }
const TYPE_LABEL: Record<BoardItem['kind'], string> = { task: 'Task', project: 'Project', folder: 'Folder' }
// Ascending status order: In Progress leads since that's what's actively
// being worked, then To Do, then the two "not being worked right now"
// states. Independent of FIXED_COLUMNS' board layout order.
const STATUS_SORT_ORDER: Record<string, number> = { 'In Progress': 0, 'To Do': 1, Done: 2, Stash: 3 }

type SortKey = 'title' | 'priority' | 'dueDate' | 'status'
type Row = { kind: 'item'; item: BoardItem; nested: boolean } | { kind: 'empty-folder'; folderId: string }

interface TableViewProps {
  items: BoardItem[]
  columns: Column[]
  showTypeColumn: boolean
  onOpenCard: (cardId: string) => void
  onMoveItem: (itemId: string, columnId: string) => void
  selectable?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (cardId: string) => void
  // Applied to a folder's filed tasks when expanded, so nested rows honor the
  // same search/priority/tag/date/status filters as the top-level rows above
  // them instead of always showing every task the folder holds.
  folderTaskFilter?: (card: Card) => boolean
}

export default function TableView({
  items,
  columns,
  showTypeColumn,
  onOpenCard,
  onMoveItem,
  selectable = false,
  selectedIds,
  onToggleSelect,
  folderTaskFilter,
}: TableViewProps) {
  const navigate = useNavigate()
  const tags = useBoardStore(useShallow(selectAllTags))
  const updateCard = useBoardStore((s) => s.updateCard)
  const updateFolder = useBoardStore((s) => s.updateFolder)
  const cardsById = useBoardStore((s) => s.cards)
  const [sortKey, setSortKey] = useState<SortKey>('status')
  const [sortDir, setSortDir] = useState<1 | -1>(1)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  const columnNameById = useMemo(() => new Map(columns.map((c) => [c.id, c.name])), [columns])
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
    return item.kind === 'task' ? item.card.priority : item.kind === 'folder' ? item.folder.priority : undefined
  }

  function dueDateOf(item: BoardItem): string | undefined {
    return item.kind === 'task' ? item.card.dueDate : item.kind === 'folder' ? item.folder.dueDate : undefined
  }

  function columnIdOf(item: BoardItem): string {
    return item.kind === 'task' ? item.card.columnId : item.kind === 'project' ? item.project.columnId : item.folder.columnId
  }

  function openItem(item: BoardItem) {
    if (item.kind === 'task') onOpenCard(item.card.id)
    else if (item.kind === 'project') navigate(`/project/${item.project.id}`)
  }

  // Mirrors FolderCard's arrow-vs-title split: the arrow expands the
  // folder's tasks inline (right below its row, same idea as the Kanban
  // dropdown), the title opens the folder's own page — in whatever the
  // current global board/table view is, same as every other navigation.
  function toggleFolderExpanded(folderId: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  function openFolder(folderId: string) {
    navigate(`/folder/${folderId}`)
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
        case 'status': {
          const rankA = STATUS_SORT_ORDER[columnNameById.get(columnIdOf(a)) ?? ''] ?? 99
          const rankB = STATUS_SORT_ORDER[columnNameById.get(columnIdOf(b)) ?? ''] ?? 99
          cmp = rankA - rankB
          break
        }
      }
      return cmp * sortDir
    })
    return rows
  }, [items, sortKey, sortDir, columnNameById])

  // Folder children render as extra rows directly under their parent,
  // outside the sort above — same as the Kanban dropdown, which always shows
  // a folder's own tasks in their own order regardless of board sort. Filters
  // still apply, though (folderTaskFilter), so a task that doesn't match the
  // active filters doesn't show just because its folder does.
  const rows = useMemo(() => {
    const out: Row[] = []
    for (const item of sorted) {
      out.push({ kind: 'item', item, nested: false })
      if (item.kind === 'folder' && expandedFolders.has(item.folder.id)) {
        const rawTasks = item.folder.taskIds.map((cid) => cardsById[cid]).filter((c): c is Card => Boolean(c))
        const filteredTasks = folderTaskFilter ? rawTasks.filter(folderTaskFilter) : rawTasks
        const tasks = sortFolderTasksForDisplay(filteredTasks, columns)
        if (tasks.length === 0) {
          out.push({ kind: 'empty-folder', folderId: item.folder.id })
        } else {
          for (const card of tasks) out.push({ kind: 'item', item: { kind: 'task', card }, nested: true })
        }
      }
    }
    return out
  }, [sorted, expandedFolders, cardsById, columns, folderTaskFilter])

  const colSpan = (showTypeColumn ? 6 : 5) + (selectable ? 1 : 0)

  return (
    <div className="flex-1 overflow-auto p-5">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            {selectable && <th className="w-8 border-b border-white/[0.06] px-3 py-2" aria-hidden="true" />}
            {showTypeColumn && (
              <th className="border-b border-white/[0.06] px-3 py-2 text-left text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                Type
              </th>
            )}
            <Th label="Title" active={sortKey === 'title'} dir={sortDir} onClick={() => toggleSort('title')} />
            <th className="border-b border-white/[0.06] px-3 py-2 text-left text-[11px] font-medium tracking-wide text-slate-500 uppercase">
              Tags
            </th>
            <Th label="Priority" active={sortKey === 'priority'} dir={sortDir} onClick={() => toggleSort('priority')} />
            <Th label="Due date" active={sortKey === 'dueDate'} dir={sortDir} onClick={() => toggleSort('dueDate')} />
            <Th label="Status" active={sortKey === 'status'} dir={sortDir} onClick={() => toggleSort('status')} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            if (row.kind === 'empty-folder') {
              return (
                <tr key={`empty:${row.folderId}`}>
                  <td colSpan={colSpan} className="border-b border-white/[0.04] px-3 py-2 pl-8 text-xs text-slate-600">
                    No tasks in this folder.
                  </td>
                </tr>
              )
            }
            const { item, nested } = row
            const id = boardItemId(item)
            const priority = priorityOf(item)
            const dueDate = dueDateOf(item)
            const columnId = columnIdOf(item)
            const tagIds = item.kind === 'task' ? item.card.tagIds : item.kind === 'folder' ? item.folder.tagIds : []
            const isExpanded = item.kind === 'folder' && expandedFolders.has(item.folder.id)
            return (
              <tr key={`${nested ? 'nested:' : ''}${id}`} className="group">
                {selectable && (
                  <td className="border-b border-white/[0.04] px-3 py-2.5 group-hover:bg-white/[0.02]">
                    {item.kind === 'task' && (
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(item.card.id) ?? false}
                        onChange={() => onToggleSelect?.(item.card.id)}
                        className="h-3.5 w-3.5 rounded border-white/20 bg-transparent accent-indigo-500"
                      />
                    )}
                  </td>
                )}
                {showTypeColumn && (
                  <td className="border-b border-white/[0.04] px-3 py-2.5 text-xs font-medium text-slate-400 group-hover:bg-white/[0.02]">
                    {TYPE_LABEL[item.kind]}
                  </td>
                )}
                <td
                  onClick={item.kind === 'task' || item.kind === 'project' ? () => openItem(item) : undefined}
                  className={`border-b border-white/[0.04] px-3 py-2.5 text-slate-100 group-hover:bg-white/[0.02] ${
                    item.kind === 'task' || item.kind === 'project' ? 'cursor-pointer' : ''
                  } ${nested ? 'pl-8 text-slate-300' : ''}`}
                >
                  {item.kind === 'folder' ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleFolderExpanded(item.folder.id)
                        }}
                        className="-m-1.5 shrink-0 p-1.5"
                      >
                        <ChevronIcon className={`h-3 w-3 text-slate-500 transition ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>
                      <span
                        onClick={() => openFolder(item.folder.id)}
                        className="cursor-pointer transition hover:text-white hover:underline"
                      >
                        {item.folder.name}
                      </span>
                      <span className="rounded-full bg-white/[0.06] px-1.5 py-px text-[11px] font-medium text-slate-500">
                        {item.folder.taskIds.length}
                      </span>
                    </div>
                  ) : (
                    boardItemTitle(item)
                  )}
                </td>
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
                  {item.kind === 'task' || item.kind === 'folder' ? (
                    <div className="flex gap-1">
                      {(['low', 'med', 'high'] as Priority[]).map((p) => {
                        const cls = COLOR_CLASSES[PRIORITY_COLOR[p]]
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() =>
                              item.kind === 'task'
                                ? updateCard(item.card.id, { priority: priority === p ? undefined : p })
                                : updateFolder(item.folder.id, { priority: priority === p ? undefined : p })
                            }
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
                  {item.kind === 'task' || item.kind === 'folder' ? (
                    <>
                      <input
                        type="date"
                        value={dueDate ?? ''}
                        onChange={(e) =>
                          item.kind === 'task'
                            ? updateCard(item.card.id, { dueDate: e.target.value || undefined })
                            : updateFolder(item.folder.id, { dueDate: e.target.value || undefined })
                        }
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
