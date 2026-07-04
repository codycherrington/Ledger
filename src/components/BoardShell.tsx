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
import Column from './Column'
import { CardBody } from './Card'
import CardDetailDialog from './CardDetailDialog'
import FilterBar from './FilterBar'
import ViewToggle from './ViewToggle'
import TableView from './TableView'
import SaveIndicator from './SaveIndicator'
import GlobalAddButton from './GlobalAddButton'
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

  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [activeItem, setActiveItem] = useState<BoardItem | null>(null)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | null>(null)
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [view, setView] = useState<'board' | 'table'>('board')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const derivedState = { columns: columnsById, projects, folders, cards }

  function itemsForColumn(columnId: string): BoardItem[] {
    return selectColumnItems(derivedState, columnId)
  }

  function matchesFilters(item: BoardItem): boolean {
    const title = item.kind === 'task' ? item.card.title : item.kind === 'project' ? item.project.name : item.folder.name
    if (search && !title.toLowerCase().includes(search.toLowerCase())) return false
    if (priorityFilter && (item.kind !== 'task' || item.card.priority !== priorityFilter)) return false
    if (tagFilter.length > 0 && (item.kind !== 'task' || !tagFilter.every((t) => item.card.tagIds.includes(t)))) return false
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

  const showTypeColumn = ownerType === 'home'
  // Table view needs every task, including ones filed inside a folder — those
  // aren't in any column's cardOrder, so itemsForColumn alone would miss them.
  // Pull them in separately via each visible folder's own taskIds.
  const columnItems = columns.flatMap((c) => itemsForColumn(c.id))
  const folderTaskItems = columnItems
    .filter((item): item is Extract<BoardItem, { kind: 'folder' }> => item.kind === 'folder')
    .flatMap((item) => item.folder.taskIds.map((id) => resolveItem(derivedState, id)))
    .filter((item): item is BoardItem => Boolean(item))
  const allItems = [...columnItems, ...folderTaskItems]

  return (
    <div className="flex h-screen flex-col">
      <header className="app-drag flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] pr-4 pl-[88px]">
        <div className="flex min-w-0 items-center gap-2">
          {onBack && (
            <button type="button" onClick={onBack} aria-label="Back" className="icon-btn no-drag">
              <BackIcon />
            </button>
          )}
          <h1 className="truncate text-[15px] font-semibold text-slate-100">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator />
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
      />

      {view === 'table' ? (
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
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-1 items-start gap-4 overflow-x-auto p-5">
            {activeColumns.map((column) => (
              <Column
                key={column.id}
                column={column}
                items={itemsForColumn(column.id).filter(matchesFilters)}
                onOpenCard={setOpenCardId}
              />
            ))}
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

      {openCardId && <CardDetailDialog cardId={openCardId} onClose={() => setOpenCardId(null)} />}
      <GlobalAddButton ownerType={ownerType} ownerId={ownerId} columns={columns} />
    </div>
  )
}
