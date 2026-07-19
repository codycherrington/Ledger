import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type Active,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { resolveItem, selectColumnItems, selectOwnerColumns, useBoardStore } from '../store/board'
import { buildTaskPrompt } from '../lib/claudeCode'
import { matchesDateFilter, matchesPriorityFilter, matchesStatusFilter, type DateFilter } from '../lib/filters'
import BoardPath from './BoardPath'
import Column from './Column'
import { CardBody } from './Card'
import CardDetailDialog from './CardDetailDialog'
import FilterBar from './FilterBar'
import ViewToggle from './ViewToggle'
import TableView from './TableView'
import SaveStatusLight from './SaveStatusLight'
import GlobalAddButton from './GlobalAddButton'
import { useViewModeStore } from '../store/viewMode'
import { BackIcon } from './icons'
import type { BoardItem, ColumnOwnerType, Priority } from '../types'

interface BoardShellProps {
  ownerType: ColumnOwnerType
  ownerId?: string
  title: string
  onBack?: () => void
  showTableToggle: boolean
}

// Drag-and-drop here has two kinds of "container" an item can land in: a
// column, or a folder's expanded task list (a droppable registered by
// FolderCard as `folder-drop:<id>`, distinct from the folder card's own
// sortable id so dragging the folder itself doesn't collide with dropping a
// task onto it). These two helpers normalize whatever dnd-kit hands back
// (a column, a folder-drop zone, or another item that itself lives in one of
// those) into a single DropTarget so the handlers below don't need to
// special-case each shape.
type DropTarget = { kind: 'column'; columnId: string } | { kind: 'folder'; folderId: string }

function resolveDropTarget(overId: string, overData: Record<string, unknown> | undefined): DropTarget | null {
  if (overData?.type === 'column') return { kind: 'column', columnId: overId }
  if (overData?.type === 'folder') return { kind: 'folder', folderId: overData.folderId as string }
  if (overData?.type === 'item') {
    if (overData.folderId) return { kind: 'folder', folderId: overData.folderId as string }
    if (overData.columnId) return { kind: 'column', columnId: overData.columnId as string }
  }
  return null
}

function resolveActiveLocation(active: Active): DropTarget | null {
  const data = active.data.current
  if (data?.folderId) return { kind: 'folder', folderId: data.folderId as string }
  if (data?.columnId) return { kind: 'column', columnId: data.columnId as string }
  return null
}

export default function BoardShell({ ownerType, ownerId, title, onBack, showTableToggle }: BoardShellProps) {
  const columns = useBoardStore(useShallow((s) => selectOwnerColumns(s, ownerType, ownerId)))
  const columnsById = useBoardStore((s) => s.columns)
  const projects = useBoardStore((s) => s.projects)
  const folders = useBoardStore((s) => s.folders)
  const cards = useBoardStore((s) => s.cards)
  const moveItem = useBoardStore((s) => s.moveItem)
  const reorderItemsInColumn = useBoardStore((s) => s.reorderItemsInColumn)
  const fileTaskInFolder = useBoardStore((s) => s.fileTaskInFolder)
  const unfileTaskFromFolder = useBoardStore((s) => s.unfileTaskFromFolder)
  const reorderFolderTasks = useBoardStore((s) => s.reorderFolderTasks)
  const setCardStatus = useBoardStore((s) => s.setCardStatus)
  const startClaudeCode = useBoardStore((s) => s.startClaudeCode)

  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [activeItem, setActiveItem] = useState<BoardItem | null>(null)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Priority[]>([])
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [dateFilter, setDateFilter] = useState<DateFilter[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const view = useViewModeStore((s) => s.view)
  const setView = useViewModeStore((s) => s.setView)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const derivedState = { columns: columnsById, projects, folders, cards }

  function itemsForColumn(columnId: string): BoardItem[] {
    return selectColumnItems(derivedState, columnId)
  }

  function matchesFilters(item: BoardItem): boolean {
    const title = item.kind === 'task' ? item.card.title : item.kind === 'project' ? item.project.name : item.folder.name
    if (search && !title.toLowerCase().includes(search.toLowerCase())) return false
    const columnId = item.kind === 'task' ? item.card.columnId : item.kind === 'project' ? item.project.columnId : item.folder.columnId
    if (!matchesStatusFilter(columnId, statusFilter)) return false
    // Projects have no priority/tags/due date, so any of those facets being
    // active simply excludes them rather than trying to match against them.
    if (item.kind === 'project') return priorityFilter.length === 0 && tagFilter.length === 0 && dateFilter.length === 0
    const priority = item.kind === 'task' ? item.card.priority : item.folder.priority
    const tagIds = item.kind === 'task' ? item.card.tagIds : item.folder.tagIds
    const dueDate = item.kind === 'task' ? item.card.dueDate : item.folder.dueDate
    if (!matchesPriorityFilter(priority, priorityFilter)) return false
    if (tagFilter.length > 0 && !tagFilter.every((t) => tagIds.includes(t))) return false
    if (!matchesDateFilter(dueDate, dateFilter)) return false
    return true
  }

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string
    setActiveItem(resolveItem(useBoardStore.getState(), id))
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over || active.data.current?.type !== 'item') return
    const activeId = active.id as string
    const overId = over.id as string
    if (activeId === overId) return

    const activeLoc = resolveActiveLocation(active)
    const target = resolveDropTarget(overId, over.data.current)
    if (!activeLoc || !target) return
    const sameContainer =
      activeLoc.kind === target.kind &&
      (activeLoc.kind === 'column' ? activeLoc.columnId === (target as { columnId: string }).columnId : activeLoc.folderId === (target as { folderId: string }).folderId)
    if (sameContainer) return

    const state = useBoardStore.getState()
    if (target.kind === 'folder') {
      const item = resolveItem(state, activeId)
      if (item?.kind !== 'task') return
      const folder = state.folders[target.folderId]
      fileTaskInFolder(activeId, target.folderId, folder ? folder.taskIds.length : 0)
    } else {
      const toColumn = state.columns[target.columnId]
      if (!toColumn) return
      const overIndex = toColumn.cardOrder.indexOf(overId)
      const newIndex = overIndex >= 0 ? overIndex : toColumn.cardOrder.length
      if (activeLoc.kind === 'folder') {
        unfileTaskFromFolder(activeId, target.columnId, newIndex)
      } else {
        moveItem(activeId, target.columnId, newIndex)
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveItem(null)
    if (!over) return
    const activeId = active.id as string
    const overId = over.id as string
    if (activeId === overId) return

    const target = resolveDropTarget(overId, over.data.current)
    if (!target) return

    const state = useBoardStore.getState()
    if (target.kind === 'folder') {
      const folder = state.folders[target.folderId]
      if (!folder || !folder.taskIds.includes(activeId)) return
      const oldIndex = folder.taskIds.indexOf(activeId)
      const newIndex = folder.taskIds.indexOf(overId)
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return
      reorderFolderTasks(folder.id, arrayMove(folder.taskIds, oldIndex, newIndex))
    } else {
      const column = state.columns[target.columnId]
      if (!column || !column.cardOrder.includes(activeId)) return
      const oldIndex = column.cardOrder.indexOf(activeId)
      const newIndex = column.cardOrder.indexOf(overId)
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return
      reorderItemsInColumn(column.id, arrayMove(column.cardOrder, oldIndex, newIndex))
    }
  }

  const activeColumns = columns.filter((c) => c.name !== 'NULLSPACE')
  const nullspaceColumn = columns.find((c) => c.name === 'NULLSPACE')

  const project = ownerType === 'project' && ownerId ? projects[ownerId] : undefined
  const claudeCodeReady = Boolean(project?.claudeCodeEnabled && project.repoPath)

  function toggleSelected(cardId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return next
    })
  }

  function startClaudeCodeForSelection() {
    if (!project?.repoPath) return
    const selectedCards = [...selectedIds].map((id) => cards[id]).filter((c): c is NonNullable<typeof c> => Boolean(c))
    if (selectedCards.length === 0) return
    void startClaudeCode(project.repoPath, buildTaskPrompt(selectedCards))
    setSelectedIds(new Set())
  }

  const showTypeColumn = ownerType === 'home'
  // TableView pulls a folder's own children in itself (gated on which
  // folders are expanded) — nothing here needs to pre-flatten them too.
  const allItems = columns.flatMap((c) => itemsForColumn(c.id))

  return (
    <div className="flex h-screen flex-col">
      <header className="app-drag flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] pr-4 pl-[88px]">
        <div className="flex min-w-0 items-center gap-2">
          {onBack && (
            <button type="button" onClick={onBack} aria-label="Back" className="icon-btn no-drag">
              <BackIcon />
            </button>
          )}
          {ownerType === 'project' ? (
            <BoardPath segments={[{ label: 'Home', path: '/' }]} current={title} />
          ) : (
            <h1 className="truncate text-[15px] font-semibold text-slate-100">{title}</h1>
          )}
        </div>
        <div className="flex items-center gap-3">
          <SaveStatusLight />
          {showTableToggle && <ViewToggle view={view} onChange={setView} />}
        </div>
      </header>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        priority={priorityFilter}
        onPriorityChange={setPriorityFilter}
        tagIds={tagFilter}
        onTagIdsChange={setTagFilter}
        columns={columns}
        statusColumnIds={statusFilter}
        onStatusColumnIdsChange={setStatusFilter}
        dateFilters={dateFilter}
        onDateFiltersChange={setDateFilter}
      />

      {view === 'table' ? (
        <>
          <div className="flex justify-start px-5 pt-4">
            <GlobalAddButton ownerType={ownerType} ownerId={ownerId} columns={columns} variant="labeled" />
          </div>
          <TableView
            items={allItems.filter(matchesFilters)}
            columns={columns}
            showTypeColumn={showTypeColumn}
            onOpenCard={setOpenCardId}
            onMoveItem={(itemId, columnId) => {
              const item = resolveItem(useBoardStore.getState(), itemId)
              // A filed task isn't in any column's cardOrder, so a real move
              // would duplicate it — only its status field should change.
              if (item?.kind === 'task' && item.card.folderId) setCardStatus(itemId, columnId)
              else moveItem(itemId, columnId, 0)
            }}
            selectable={claudeCodeReady}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelected}
          />
        </>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-1 items-start gap-4 overflow-x-auto p-5">
            {activeColumns.map((column) => {
              const columnItems = itemsForColumn(column.id).filter(matchesFilters)
              // Only raw tasks sitting directly in the column count — a
              // folder card here doesn't mean "launch everything inside it",
              // so folder contents are deliberately excluded.
              const taskCards = columnItems
                .filter((item): item is Extract<BoardItem, { kind: 'task' }> => item.kind === 'task')
                .map((item) => item.card)
              let headerAction = null
              if (column.name === 'To Do') {
                headerAction = <GlobalAddButton ownerType={ownerType} ownerId={ownerId} columns={columns} variant="compact" />
              } else if (column.name === 'In Progress' && claudeCodeReady) {
                headerAction = (
                  <button
                    type="button"
                    onClick={() => project?.repoPath && taskCards.length > 0 && startClaudeCode(project.repoPath, buildTaskPrompt(taskCards))}
                    disabled={taskCards.length === 0}
                    title="Launch all tasks in this column in Claude Code"
                    className="shrink-0 rounded-md bg-indigo-500 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-slate-500 disabled:hover:bg-white/[0.06]"
                  >
                    Launch all
                  </button>
                )
              }
              return <Column key={column.id} column={column} items={columnItems} onOpenCard={setOpenCardId} headerAction={headerAction} />
            })}
            {nullspaceColumn && (
              <>
                <div className="mx-1 w-px shrink-0 self-stretch bg-white/10" aria-hidden="true" />
                <Column
                  key={nullspaceColumn.id}
                  column={nullspaceColumn}
                  items={itemsForColumn(nullspaceColumn.id).filter(matchesFilters)}
                  onOpenCard={setOpenCardId}
                />
              </>
            )}
          </div>
          <DragOverlay>
            {activeItem?.kind === 'task' ? (
              <div className="w-[300px] rounded-xl border border-white/[0.14] bg-raised p-3.5 shadow-xl shadow-black/50">
                <CardBody card={activeItem.card} />
              </div>
            ) : activeItem ? (
              <div className="w-[300px] rounded-xl border border-white/[0.14] bg-raised p-3.5 shadow-xl shadow-black/50">
                <p className="text-sm font-medium text-slate-100">
                  {activeItem.kind === 'project' ? activeItem.project.name : activeItem.folder.name}
                </p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {claudeCodeReady && selectedIds.size > 0 && (
        <div className="no-drag fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-white/10 bg-raised px-4 py-2.5 shadow-xl shadow-black/40">
          <span className="text-xs font-medium text-slate-400">
            {selectedIds.size} task{selectedIds.size === 1 ? '' : 's'} selected
          </span>
          <button
            type="button"
            onClick={startClaudeCodeForSelection}
            className="rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/30"
          >
            Start in Claude Code
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-xs font-medium text-slate-500 transition hover:text-slate-300"
          >
            Clear
          </button>
        </div>
      )}

      {openCardId && <CardDetailDialog cardId={openCardId} onClose={() => setOpenCardId(null)} />}
    </div>
  )
}
