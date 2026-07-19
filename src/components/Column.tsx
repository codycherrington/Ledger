import type { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { BoardItem, Column as ColumnType } from '../types'
import { COLOR_CLASSES } from '../lib/colors'
import { boardItemId } from '../store/board'
import Card from './Card'
import ProjectCard from './ProjectCard'
import FolderCard from './FolderCard'

interface ColumnProps {
  column: ColumnType
  items: BoardItem[]
  onOpenCard: (cardId: string) => void
  // Arbitrary control rendered top-right of the column header, next to the
  // count badge — e.g. the add-item button on "To Do", the Claude Code
  // launch-all button on "In Progress", or the collapse toggle on "Done".
  // Callers decide which column (if any) gets one; Column itself stays
  // agnostic to what the action does.
  headerAction?: ReactNode
  // When true, hides the card list so the column takes up less vertical
  // space (width stays fixed) while still showing its header (name + count).
  // The droppable ref stays on the outer container (not the hidden list) so
  // drag-and-drop into a collapsed column keeps working.
  collapsed?: boolean
}

export default function Column({ column, items, onOpenCard, headerAction, collapsed = false }: ColumnProps) {
  const { setNodeRef: setDroppableRef } = useDroppable({ id: column.id, data: { type: 'column' } })
  const isStash = column.name === 'Stash'
  const colorClasses = COLOR_CLASSES[column.color as keyof typeof COLOR_CLASSES] ?? COLOR_CLASSES.slate

  return (
    <div
      ref={setDroppableRef}
      className={
        isStash
          ? 'flex max-h-full w-[300px] shrink-0 flex-col rounded-2xl border border-dashed border-white/15 bg-white/[0.015]'
          : 'flex max-h-full w-[300px] shrink-0 flex-col rounded-2xl border border-white/[0.05] bg-white/[0.025]'
      }
    >
      <div className="flex items-center justify-between rounded-t-2xl px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${colorClasses.dot}`} />
          <span className={`truncate text-sm font-semibold ${isStash ? 'text-slate-500' : 'text-slate-200'}`}>
            {column.name}
          </span>
          <span className="rounded-full bg-white/[0.06] px-1.5 py-px text-[11px] font-medium text-slate-500">
            {items.length}
          </span>
        </div>
        {headerAction}
      </div>

      {!collapsed && (
        <div className="min-h-2 flex-1 space-y-2 overflow-y-auto px-2.5 pb-2.5">
          <SortableContext items={items.map(boardItemId)} strategy={verticalListSortingStrategy}>
            {items.map((item) => {
              switch (item.kind) {
                case 'task':
                  return <Card key={item.card.id} card={item.card} onOpen={onOpenCard} />
                case 'project':
                  return <ProjectCard key={item.project.id} project={item.project} />
                case 'folder':
                  return <FolderCard key={item.folder.id} folder={item.folder} onOpenCard={onOpenCard} />
              }
            })}
          </SortableContext>
        </div>
      )}
    </div>
  )
}
