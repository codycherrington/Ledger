import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useShallow } from 'zustand/react/shallow'
import { COLOR_CLASSES, PRIORITY_COLOR, type ColorName } from '../lib/colors'
import { formatDueDate, isDueToday, isOverdue } from '../lib/dates'
import { useSortableItem } from '../lib/useSortableItem'
import { buildTaskPrompt } from '../lib/claudeCode'
import { selectAllTags, selectFolderTasks, selectOwnerColumns, sortFolderTasksForDisplay, useBoardStore } from '../store/board'
import ItemTypeBadge from './ItemTypeBadge'
import Card from './Card'
import CopyButton from './CopyButton'
import FolderDetailDialog from './FolderDetailDialog'
import { ChevronIcon, FolderIcon, InfoIcon, PlusIcon } from './icons'
import type { Folder, Priority } from '../types'

const PRIORITY_LABEL: Record<Priority, string> = { low: 'Low', med: 'Medium', high: 'High' }

interface FolderCardProps {
  folder: Folder
  onOpenCard: (cardId: string) => void
}

export default function FolderCard({ folder, onOpenCard }: FolderCardProps) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, style } = useSortableItem(folder.id, { columnId: folder.columnId })
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  // Lets a standalone task be dragged straight onto the collapsed card to
  // file it, without needing to expand the folder first. A distinct id from
  // the expanded FolderTaskList's own `folder-drop:<id>` droppable below (and
  // disabled whenever that one is actually mounted), so the two never
  // register the same id at once — resolveDropTarget only reads `data.type`/
  // `data.folderId`, not the literal id, so both resolve identically.
  const { setNodeRef: setCardDropRef, isOver: isCardDropOver } = useDroppable({
    id: `folder-card-drop:${folder.id}`,
    data: { type: 'folder', folderId: folder.id },
    disabled: expanded,
  })
  const colorClasses = COLOR_CLASSES[folder.color as ColorName] ?? COLOR_CLASSES.slate
  const allTags = useBoardStore(useShallow(selectAllTags))
  const folderTags = allTags.filter((t) => folder.tagIds.includes(t.id))
  const folderTasks = useBoardStore(useShallow((s) => selectFolderTasks(s, folder.id)))
  // Description first, then every filed task's own title/summary below it —
  // one paste gives Claude Code the folder's context plus everything in it.
  const copyText = [folder.description, buildTaskPrompt(folderTasks)].filter(Boolean).join('\n\n')

  return (
    <>
      <div
        ref={setCardDropRef}
        className={`group rounded-xl border shadow-sm shadow-black/20 transition hover:border-white/[0.16] ${
          isCardDropOver ? 'border-indigo-400/60 bg-indigo-500/[0.08]' : 'border-white/[0.07] bg-raised'
        }`}
      >
        {/* The sortable ref (for dragging the folder itself between columns)
            is scoped to just this header, not the whole card — the expanded
            task list below is a separate droppable (`folder-drop:<id>`, see
            FolderTaskList) and needs to stay out of this element's rect so
            the two drop targets never overlap. */}
        <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...listeners}
          className="cursor-grab p-3.5 active:cursor-grabbing"
        >
          {/* float (not absolute) so wrapping name/description text flows
              around the icon instead of ever being able to sit underneath it */}
          <button
            type="button"
            aria-label="Folder details"
            onClick={(e) => {
              e.stopPropagation()
              setEditing(true)
            }}
            className="icon-btn float-right mb-1 ml-2 opacity-0 transition group-hover:opacity-100"
          >
            <InfoIcon className="h-3.5 w-3.5" />
          </button>
          {folder.description?.trim() && (
            <span
              onClick={(e) => e.stopPropagation()}
              className="float-right mb-1 ml-2 opacity-0 transition group-hover:opacity-100"
            >
              <CopyButton text={copyText} label="Copy description" />
            </span>
          )}
          <ItemTypeBadge kind="folder" />
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              aria-label={expanded ? 'Collapse folder' : 'Expand folder'}
              onClick={(e) => {
                e.stopPropagation()
                setExpanded((v) => !v)
              }}
              className="-m-1.5 shrink-0 p-1.5"
            >
              <ChevronIcon className={`h-3 w-3 text-slate-500 transition ${expanded ? 'rotate-90' : ''}`} />
            </button>
            <FolderIcon className={`h-3.5 w-3.5 shrink-0 ${colorClasses.text}`} />
            <p
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/folder/${folder.id}`)
              }}
              className="truncate text-sm font-medium text-slate-100 transition hover:text-white hover:underline"
            >
              {folder.name}
            </p>
            <span className="rounded-full bg-white/[0.06] px-1.5 py-px text-[11px] font-medium text-slate-500">
              {folder.taskIds.length}
            </span>
          </div>
          {folder.description && <p className="mt-1.5 line-clamp-2 text-xs text-slate-400">{folder.description}</p>}
          {(folder.priority || folder.dueDate || folderTags.length > 0) && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {folder.priority && (
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${COLOR_CLASSES[PRIORITY_COLOR[folder.priority]].bgSoft} ${COLOR_CLASSES[PRIORITY_COLOR[folder.priority]].text}`}
                >
                  {PRIORITY_LABEL[folder.priority]}
                </span>
              )}
              {folder.dueDate && (
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                    isOverdue(folder.dueDate)
                      ? 'bg-rose-400/10 text-rose-300'
                      : isDueToday(folder.dueDate)
                        ? 'bg-amber-400/10 text-amber-300'
                        : 'bg-white/[0.06] text-slate-400'
                  }`}
                >
                  {formatDueDate(folder.dueDate)}
                </span>
              )}
              {folderTags.map((tag) => {
                const cls = COLOR_CLASSES[tag.color as ColorName] ?? COLOR_CLASSES.slate
                return (
                  <span key={tag.id} className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${cls.bgSoft} ${cls.text}`}>
                    {tag.name}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {expanded && <FolderTaskList folder={folder} onOpenCard={onOpenCard} />}
      </div>

      <FolderDetailDialog open={editing} onOpenChange={setEditing} folder={folder} />
    </>
  )
}

function FolderTaskList({ folder, onOpenCard }: { folder: Folder; onOpenCard: (cardId: string) => void }) {
  const rawTasks = useBoardStore(useShallow((s) => selectFolderTasks(s, folder.id)))
  const ownerColumns = useBoardStore(useShallow((s) => selectOwnerColumns(s, folder.ownerType, folder.ownerId)))
  const tasks = sortFolderTasksForDisplay(rawTasks, ownerColumns)
  const createCardInFolder = useBoardStore((s) => s.createCardInFolder)
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `folder-drop:${folder.id}`,
    data: { type: 'folder', folderId: folder.id },
  })
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  function submitDraft() {
    const title = draft.trim()
    if (title) createCardInFolder(folder.id, title)
    setDraft('')
    setAdding(false)
  }

  return (
    <div
      ref={setDropRef}
      onClick={(e) => e.stopPropagation()}
      className={`min-h-[3.5rem] space-y-2 border-t border-white/[0.06] p-2.5 transition ${isOver ? 'bg-indigo-500/[0.08]' : ''}`}
    >
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((task) => (
          <Card key={task.id} card={task} onOpen={onOpenCard} />
        ))}
      </SortableContext>
      {tasks.length === 0 && !adding && <p className="px-1 py-1 text-xs text-slate-600">Drag tasks here to file them in.</p>}
      {adding ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submitDraft()
            }
            if (e.key === 'Escape') {
              setAdding(false)
              setDraft('')
            }
          }}
          onBlur={submitDraft}
          rows={2}
          placeholder="Task title"
          className="input resize-none"
        />
      ) : (
        <button type="button" onClick={() => setAdding(true)} aria-label="Add task" className="icon-btn">
          <PlusIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

