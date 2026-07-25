import { useState } from 'react'
import Menu from './Menu'
import FolderDetailDialog from './FolderDetailDialog'
import ProjectDetailDialog from './ProjectDetailDialog'
import { useBoardStore } from '../store/board'
import { PlusIcon } from './icons'
import type { Column, ColumnOwnerType } from '../types'

interface GlobalAddButtonProps {
  ownerType: ColumnOwnerType
  ownerId?: string
  columns: Column[]
  // When set, this button is scoped to a single folder: it only ever creates
  // a task (a folder can't directly contain a folder or project), skipping
  // the Task/Folder/Project menu entirely.
  folderId?: string
  // 'compact' sits inline in a column header (icon only); 'labeled' sits
  // above the table in Table view (icon + "New Item" text).
  variant?: 'compact' | 'labeled'
  // Opens the newly-created task's detail dialog — the caller already owns
  // the "which card is open" state (BoardShell/FolderBoardShell), so a new
  // task reuses that single central dialog instead of this component
  // mounting a second one for the same card.
  onOpenCard: (cardId: string) => void
}

export default function GlobalAddButton({ ownerType, ownerId, columns, folderId, variant = 'compact', onOpenCard }: GlobalAddButtonProps) {
  const createCard = useBoardStore((s) => s.createCard)
  const createCardInFolder = useBoardStore((s) => s.createCardInFolder)
  const createFolder = useBoardStore((s) => s.createFolder)
  const createProject = useBoardStore((s) => s.createProject)
  const [openFolderId, setOpenFolderId] = useState<string | null>(null)
  const [openProjectId, setOpenProjectId] = useState<string | null>(null)
  const openFolder = useBoardStore((s) => (openFolderId ? s.folders[openFolderId] : undefined))

  // Always lands in "To Do" — this is the one global add affordance for the
  // whole board, so it doesn't ask which column; per-column placement still
  // happens by dragging afterward.
  const todoColumn = columns.find((c) => c.name === 'To Do')
  const canAddProject = !folderId && ownerType === 'home'

  function addTask() {
    if (folderId) {
      onOpenCard(createCardInFolder(folderId, 'New Task'))
    } else if (todoColumn) {
      onOpenCard(createCard(todoColumn.id, 'New Task'))
    }
  }

  function addFolder() {
    if (!todoColumn) return
    setOpenFolderId(createFolder(ownerType, ownerId, todoColumn.id, 'New Folder'))
  }

  function addProject() {
    if (!todoColumn) return
    setOpenProjectId(createProject('New Project', undefined, todoColumn.id))
  }

  if (!folderId && !todoColumn) return null

  const triggerClasses =
    variant === 'labeled'
      ? 'flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-2.5 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/30'
      : 'flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-500 text-white transition hover:bg-indigo-400'

  return (
    <>
      {folderId ? (
        // A folder can only directly contain tasks, so there's nothing to
        // choose — skip the menu and create straight away.
        <button type="button" aria-label="Add task" onClick={addTask} className={triggerClasses}>
          <PlusIcon className="h-3.5 w-3.5" />
          {variant === 'labeled' && 'New Item'}
        </button>
      ) : (
        <Menu
          trigger={
            <button type="button" aria-label="Add" className={triggerClasses}>
              <PlusIcon className="h-3.5 w-3.5" />
              {variant === 'labeled' && 'New Item'}
            </button>
          }
          items={[
            { label: 'Task', onSelect: addTask },
            { label: 'Folder', onSelect: addFolder },
            ...(canAddProject ? [{ label: 'Project', onSelect: addProject }] : []),
          ]}
        />
      )}

      {openFolder && (
        <FolderDetailDialog open folder={openFolder} startInEditMode onOpenChange={(open) => !open && setOpenFolderId(null)} />
      )}
      {openProjectId && (
        <ProjectDetailDialog projectId={openProjectId} startInEditMode onClose={() => setOpenProjectId(null)} />
      )}
    </>
  )
}
