import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { reorderFolderTaskIdsWithinColumn, selectOwnerColumns, useBoardStore } from '../store/board'
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
import type { BoardItem, Card, Folder, Priority } from '../types'

interface FolderBoardShellProps {
  folder: Folder
  onBack: () => void
}

// Sibling to BoardShell, scoped to a single folder. Every draggable here
// already belongs to this one folder, so unlike BoardShell there's only one
// "container kind" to reason about (which status column an item is in) — no
// folder-drop-zone disambiguation needed.
export default function FolderBoardShell({ folder, onBack }: FolderBoardShellProps) {
  const columns = useBoardStore(useShallow((s) => selectOwnerColumns(s, folder.ownerType, folder.ownerId)))
  const cards = useBoardStore((s) => s.cards)
  const projects = useBoardStore((s) => s.projects)
  const reorderFolderTasks = useBoardStore((s) => s.reorderFolderTasks)
  const setCardStatus = useBoardStore((s) => s.setCardStatus)
  const startClaudeCode = useBoardStore((s) => s.startClaudeCode)

  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Priority[]>([])
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [dateFilter, setDateFilter] = useState<DateFilter[]>([])
  const view = useViewModeStore((s) => s.view)
  const setView = useViewModeStore((s) => s.setView)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function matchesFilters(card: Card): boolean {
    if (search && !card.title.toLowerCase().includes(search.toLowerCase())) return false
    if (!matchesPriorityFilter(card.priority, priorityFilter)) return false
    if (tagFilter.length > 0 && !tagFilter.every((t) => card.tagIds.includes(t))) return false
    if (!matchesDateFilter(card.dueDate, dateFilter)) return false
    if (!matchesStatusFilter(card.columnId, statusFilter)) return false
    return true
  }

  function tasksForColumn(columnId: string): Card[] {
    return folder.taskIds.map((id) => cards[id]).filter((c): c is Card => Boolean(c) && c.columnId === columnId)
  }

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string
    setActiveCard(cards[id] ?? null)
  }

  // Cross-column drag: re-parent the card's status live, same feel as
  // BoardShell. A same-folder status change never touches taskIds order — the
  // card just reappears in its new column's filtered subset wherever it
  // already sat in folder.taskIds.
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeId = active.id as string
    const activeColumnId = active.data.current?.columnId as string | undefined
    const overData = over.data.current
    const targetColumnId = overData?.type === 'column' ? (over.id as string) : (overData?.columnId as string | undefined)
    if (!activeColumnId || !targetColumnId || activeColumnId === targetColumnId) return
    setCardStatus(activeId, targetColumnId)
  }

  // Same-column reorder: only fires when dropped onto another card (not empty
  // column space). By this point handleDragOver has already committed any
  // cross-column status change, so over's columnId is the correct column for
  // both active and over.
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveCard(null)
    if (!over || active.id === over.id) return
    const overData = over.data.current
    if (overData?.type !== 'item') return
    const columnId = overData.columnId as string
    const state = useBoardStore.getState()
    const currentFolder = state.folders[folder.id]
    if (!currentFolder) return
    const newTaskIds = reorderFolderTaskIdsWithinColumn(currentFolder, state.cards, columnId, active.id as string, over.id as string)
    if (newTaskIds) reorderFolderTasks(folder.id, newTaskIds)
  }

  const activeColumns = columns.filter((c) => c.name !== 'Stash')
  const stashColumn = columns.find((c) => c.name === 'Stash')
  const allTasks = folder.taskIds.map((id) => cards[id]).filter((c): c is Card => Boolean(c))

  const project = folder.ownerType === 'project' && folder.ownerId ? projects[folder.ownerId] : undefined
  const claudeCodeReady = Boolean(project?.claudeCodeEnabled && project.repoPath)

  const pathSegments = [{ label: 'Home', path: '/' }]
  if (project) pathSegments.push({ label: project.name, path: `/project/${project.id}` })

  return (
    <div className="flex h-screen flex-col">
      <header className="app-drag flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] pr-4 pl-[88px]">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={onBack} aria-label="Back" className="icon-btn no-drag">
            <BackIcon />
          </button>
          <BoardPath segments={pathSegments} current={folder.name} />
        </div>
        <div className="flex items-center gap-3">
          <SaveStatusLight />
          <ViewToggle view={view} onChange={setView} />
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
            <GlobalAddButton folderId={folder.id} ownerType={folder.ownerType} ownerId={folder.ownerId} columns={columns} variant="labeled" />
          </div>
          <TableView
            items={allTasks.filter(matchesFilters).map((card): BoardItem => ({ kind: 'task', card }))}
            columns={columns}
            showTypeColumn={false}
            onOpenCard={setOpenCardId}
            onMoveItem={(itemId, columnId) => setCardStatus(itemId, columnId)}
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
              const taskCards = tasksForColumn(column.id).filter(matchesFilters)
              let headerAction = null
              if (column.name === 'To Do') {
                headerAction = (
                  <GlobalAddButton folderId={folder.id} ownerType={folder.ownerType} ownerId={folder.ownerId} columns={columns} variant="compact" />
                )
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
              return (
                <Column
                  key={column.id}
                  column={column}
                  items={taskCards.map((card): BoardItem => ({ kind: 'task', card }))}
                  onOpenCard={setOpenCardId}
                  headerAction={headerAction}
                />
              )
            })}
            {stashColumn && (
              <>
                <div className="mx-1 w-px shrink-0 self-stretch bg-white/10" aria-hidden="true" />
                <Column
                  key={stashColumn.id}
                  column={stashColumn}
                  items={tasksForColumn(stashColumn.id)
                    .filter(matchesFilters)
                    .map((card): BoardItem => ({ kind: 'task', card }))}
                  onOpenCard={setOpenCardId}
                />
              </>
            )}
          </div>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[300px] rounded-xl border border-white/[0.14] bg-raised p-3.5 shadow-xl shadow-black/50">
                <CardBody card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {openCardId && <CardDetailDialog cardId={openCardId} onClose={() => setOpenCardId(null)} />}
    </div>
  )
}
