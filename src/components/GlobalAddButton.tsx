import { useState } from 'react'
import Menu from './Menu'
import ProjectFormModal from './ProjectFormModal'
import { useBoardStore } from '../store/board'
import { PlusIcon } from './icons'
import type { Column, ColumnOwnerType } from '../types'

interface GlobalAddButtonProps {
  ownerType: ColumnOwnerType
  ownerId?: string
  columns: Column[]
  // When set, this button is scoped to a single folder: it only ever creates
  // a task (a folder can't directly contain a folder or project), skipping
  // the Task/Folder/Project menu entirely, and files the new task straight
  // into the folder instead of the owner board's "To Do" column.
  folderId?: string
}

export default function GlobalAddButton({ ownerType, ownerId, columns, folderId }: GlobalAddButtonProps) {
  const createCard = useBoardStore((s) => s.createCard)
  const createCardInFolder = useBoardStore((s) => s.createCardInFolder)
  const createFolder = useBoardStore((s) => s.createFolder)
  const createProject = useBoardStore((s) => s.createProject)
  const [draftKind, setDraftKind] = useState<'task' | 'folder' | null>(null)
  const [draft, setDraft] = useState('')
  const [projectModalOpen, setProjectModalOpen] = useState(false)

  // Always lands in "To Do" — this is the one global add affordance for the
  // whole board, so it doesn't ask which column; per-column placement still
  // happens by dragging afterward.
  const todoColumn = columns.find((c) => c.name === 'To Do')
  const canAddProject = !folderId && ownerType === 'home'

  function submit() {
    const title = draft.trim()
    if (title) {
      if (folderId) createCardInFolder(folderId, title)
      else if (todoColumn) {
        if (draftKind === 'folder') createFolder(ownerType, ownerId, todoColumn.id, title)
        else createCard(todoColumn.id, title)
      }
    }
    setDraft('')
    setDraftKind(null)
  }

  if (!folderId && !todoColumn) return null

  return (
    <div className="no-drag fixed bottom-5 left-5 z-40">
      {draftKind ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="bg-panel w-64 rounded-xl border border-white/10 p-2 shadow-xl shadow-black/40"
        >
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
              if (e.key === 'Escape') {
                setDraftKind(null)
                setDraft('')
              }
            }}
            onBlur={submit}
            rows={2}
            placeholder={draftKind === 'folder' ? 'Folder name' : 'Task title'}
            className="input resize-none"
          />
        </form>
      ) : folderId ? (
        // A folder can only directly contain tasks, so there's nothing to
        // choose — skip the menu and go straight into the title textarea.
        <button
          type="button"
          aria-label="Add task"
          onClick={() => setDraftKind('task')}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg shadow-black/40 transition hover:bg-indigo-400"
        >
          <PlusIcon className="h-5 w-5" />
        </button>
      ) : (
        <Menu
          trigger={
            <button
              type="button"
              aria-label="Add"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg shadow-black/40 transition hover:bg-indigo-400"
            >
              <PlusIcon className="h-5 w-5" />
            </button>
          }
          items={[
            { label: 'Task', onSelect: () => setDraftKind('task') },
            { label: 'Folder', onSelect: () => setDraftKind('folder') },
            ...(canAddProject ? [{ label: 'Project', onSelect: () => setProjectModalOpen(true) }] : []),
          ]}
        />
      )}

      {canAddProject && todoColumn && (
        <ProjectFormModal
          open={projectModalOpen}
          onOpenChange={setProjectModalOpen}
          title="New Project"
          submitLabel="Create"
          onSubmit={(name, description) => {
            createProject(name, description, todoColumn.id)
            setProjectModalOpen(false)
          }}
        />
      )}
    </div>
  )
}
