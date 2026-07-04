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
}

export default function GlobalAddButton({ ownerType, ownerId, columns }: GlobalAddButtonProps) {
  const createCard = useBoardStore((s) => s.createCard)
  const createFolder = useBoardStore((s) => s.createFolder)
  const createProject = useBoardStore((s) => s.createProject)
  const [draftKind, setDraftKind] = useState<'task' | 'folder' | null>(null)
  const [draft, setDraft] = useState('')
  const [projectModalOpen, setProjectModalOpen] = useState(false)

  // Always lands in "To Do" — this is the one global add affordance for the
  // whole board, so it doesn't ask which column; per-column placement still
  // happens by dragging afterward.
  const todoColumn = columns.find((c) => c.name === 'To Do')
  const canAddProject = ownerType === 'home'

  function submit() {
    const title = draft.trim()
    if (title && todoColumn) {
      if (draftKind === 'folder') createFolder(ownerType, ownerId, todoColumn.id, title)
      else createCard(todoColumn.id, title)
    }
    setDraft('')
    setDraftKind(null)
  }

  if (!todoColumn) return null

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

      {canAddProject && (
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
