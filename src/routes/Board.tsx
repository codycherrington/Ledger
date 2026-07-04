import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
import { arrayMove } from '@dnd-kit/sortable'
import { selectProjectColumns, useBoardStore } from '../store/board'
import Column from '../components/Column'
import { CardBody } from '../components/Card'
import CardDetailDialog from '../components/CardDetailDialog'
import FilterBar from '../components/FilterBar'
import { BackIcon } from '../components/icons'
import type { Card, Priority } from '../types'

export default function Board() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const project = useBoardStore((s) => s.projects[projectId])
  const columns = useBoardStore(useShallow((s) => selectProjectColumns(s, projectId)))
  const cardsById = useBoardStore((s) => s.cards)
  const moveCard = useBoardStore((s) => s.moveCard)
  const reorderCardsInColumn = useBoardStore((s) => s.reorderCardsInColumn)

  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | null>(null)
  const [tagFilter, setTagFilter] = useState<string[]>([])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  if (!project) {
    return (
      <div className="flex h-screen flex-col">
        <div className="app-drag h-11 shrink-0" />
        <div className="mx-auto max-w-lg px-6 py-24 text-center">
          <p className="text-slate-400">Project not found.</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-3 text-sm font-medium text-indigo-400 hover:text-indigo-300"
          >
            ← Back to projects
          </button>
        </div>
      </div>
    )
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveCardId(event.active.id as string)
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over || active.data.current?.type !== 'card') return
    const activeId = active.id as string
    const overId = over.id as string
    if (activeId === overId) return

    const cols = selectProjectColumns(useBoardStore.getState(), projectId)
    const activeColumn = cols.find((c) => c.cardOrder.includes(activeId))
    const overColumn = cols.find((c) => c.id === overId) ?? cols.find((c) => c.cardOrder.includes(overId))
    if (!activeColumn || !overColumn || activeColumn.id === overColumn.id) return

    const overIndex = overColumn.cardOrder.indexOf(overId)
    const newIndex = overIndex >= 0 ? overIndex : overColumn.cardOrder.length
    moveCard(activeId, overColumn.id, newIndex)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveCardId(null)
    if (!over) return
    const activeId = active.id as string
    const overId = over.id as string
    if (activeId === overId) return

    const cols = selectProjectColumns(useBoardStore.getState(), projectId)
    const activeColumn = cols.find((c) => c.cardOrder.includes(activeId))
    if (!activeColumn) return
    const overColumn = cols.find((c) => c.id === overId) ?? cols.find((c) => c.cardOrder.includes(overId))
    if (!overColumn || activeColumn.id !== overColumn.id) return

    const oldIndex = activeColumn.cardOrder.indexOf(activeId)
    const newIndex = activeColumn.cardOrder.indexOf(overId)
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return
    reorderCardsInColumn(activeColumn.id, arrayMove(activeColumn.cardOrder, oldIndex, newIndex))
  }

  const activeCard = activeCardId ? cardsById[activeCardId] : null

  function matchesFilters(card: Card): boolean {
    if (search && !card.title.toLowerCase().includes(search.toLowerCase())) return false
    if (priorityFilter && card.priority !== priorityFilter) return false
    if (tagFilter.length > 0 && !tagFilter.every((t) => card.tagIds.includes(t))) return false
    return true
  }

  const activeColumns = columns.filter((c) => c.name !== 'NULLSPACE')
  const nullspaceColumn = columns.find((c) => c.name === 'NULLSPACE')

  return (
    <div className="flex h-screen flex-col">
      <header className="app-drag flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] pr-4 pl-[88px]">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Back to projects"
            className="icon-btn no-drag"
          >
            <BackIcon />
          </button>
          <h1 className="truncate text-[15px] font-semibold text-slate-100">{project.name}</h1>
        </div>
      </header>

      <FilterBar
        projectId={projectId}
        search={search}
        onSearchChange={setSearch}
        priority={priorityFilter}
        onPriorityChange={setPriorityFilter}
        tagIds={tagFilter}
        onTagIdsChange={setTagFilter}
      />

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
              cards={column.cardOrder
                .map((id) => cardsById[id])
                .filter((c): c is Card => Boolean(c))
                .filter(matchesFilters)}
              onOpenCard={setOpenCardId}
            />
          ))}
          {nullspaceColumn && (
            <>
              <div className="mx-1 w-px shrink-0 self-stretch bg-white/10" aria-hidden="true" />
              <Column
                key={nullspaceColumn.id}
                column={nullspaceColumn}
                cards={nullspaceColumn.cardOrder
                  .map((id) => cardsById[id])
                  .filter((c): c is Card => Boolean(c))
                  .filter(matchesFilters)}
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

      {openCardId && <CardDetailDialog cardId={openCardId} onClose={() => setOpenCardId(null)} />}
    </div>
  )
}
