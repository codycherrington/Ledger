import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useShallow } from 'zustand/react/shallow'
import { COLOR_CLASSES, COLOR_NAMES, type ColorName } from '../lib/colors'
import { useSortableItem } from '../lib/useSortableItem'
import { selectFolderTasks, useBoardStore } from '../store/board'
import Modal from './Modal'
import ItemTypeBadge from './ItemTypeBadge'
import Card from './Card'
import { BoardGlyph, ChevronIcon, FolderIcon, InfoIcon, PlusIcon } from './icons'
import type { Folder } from '../types'

interface FolderCardProps {
  folder: Folder
  onOpenCard: (cardId: string) => void
}

export default function FolderCard({ folder, onOpenCard }: FolderCardProps) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, style } = useSortableItem(folder.id, { columnId: folder.columnId })
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const colorClasses = COLOR_CLASSES[folder.color as ColorName] ?? COLOR_CLASSES.slate

  return (
    <>
      <div className="group rounded-xl border border-white/[0.07] bg-raised shadow-sm shadow-black/20 transition hover:border-white/[0.16]">
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
          <button
            type="button"
            aria-label="Open folder board"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/folder/${folder.id}`)
            }}
            className="icon-btn float-right mb-1 ml-2 opacity-0 transition group-hover:opacity-100"
          >
            <BoardGlyph className="h-3.5 w-3.5" />
          </button>
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
        </div>

        {expanded && <FolderTaskList folder={folder} onOpenCard={onOpenCard} />}
      </div>

      <FolderFormModal open={editing} onOpenChange={setEditing} folder={folder} />
    </>
  )
}

function FolderTaskList({ folder, onOpenCard }: { folder: Folder; onOpenCard: (cardId: string) => void }) {
  const tasks = useBoardStore(useShallow((s) => selectFolderTasks(s, folder.id)))
  const createCardInFolder = useBoardStore((s) => s.createCardInFolder)
  const { setNodeRef: setDropRef } = useDroppable({
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
      className="min-h-[3.5rem] space-y-2 border-t border-white/[0.06] p-2.5"
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

function FolderFormModal({
  open,
  onOpenChange,
  folder,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  folder: Folder
}) {
  const updateFolder = useBoardStore((s) => s.updateFolder)
  const deleteFolder = useBoardStore((s) => s.deleteFolder)
  const [name, setName] = useState(folder.name)
  const [description, setDescription] = useState(folder.description ?? '')
  const [color, setColor] = useState<ColorName>((folder.color as ColorName) ?? 'slate')

  function handleDelete() {
    if (window.confirm(`Delete "${folder.name}"? Its tasks will move back to the board.`)) {
      deleteFolder(folder.id)
      onOpenChange(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (next) {
          setName(folder.name)
          setDescription(folder.description ?? '')
          setColor((folder.color as ColorName) ?? 'slate')
        }
      }}
      title="Edit Folder"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          updateFolder(folder.id, { name: name.trim(), description: description.trim() || undefined, color })
          onOpenChange(false)
        }}
      >
        <label className="block text-sm font-medium text-slate-300">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input mt-1.5"
          placeholder="e.g. Phase 1"
        />
        <label className="mt-4 block text-sm font-medium text-slate-300">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="input mt-1.5 resize-none"
        />
        <label className="mt-4 block text-sm font-medium text-slate-300">Color</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {COLOR_NAMES.map((c) => (
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
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={!name.trim()} className="btn-primary">
            Save
          </button>
        </div>
      </form>
      <div className="mt-5 border-t border-white/[0.06] pt-4">
        <button type="button" onClick={handleDelete} className="btn-danger-link">
          Delete folder
        </button>
      </div>
    </Modal>
  )
}
