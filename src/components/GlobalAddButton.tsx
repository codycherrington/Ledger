import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
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
  // 'compact' sits inline in a column header (icon only); 'labeled' sits
  // above the table in Table view (icon + "New Item" text).
  variant?: 'compact' | 'labeled'
}

export default function GlobalAddButton({ ownerType, ownerId, columns, folderId, variant = 'compact' }: GlobalAddButtonProps) {
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

  function discard() {
    setDraft('')
    setDraftKind(null)
  }

  if (!folderId && !todoColumn) return null

  const triggerClasses =
    variant === 'labeled'
      ? 'flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-2.5 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/30'
      : 'flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-500 text-white transition hover:bg-indigo-400'

  return (
    <Popover.Root open={draftKind !== null} onOpenChange={(open) => !open && submit()}>
      {folderId ? (
        // A folder can only directly contain tasks, so there's nothing to
        // choose — skip the menu and go straight into the title textarea.
        <Popover.Anchor asChild>
          <button type="button" aria-label="Add task" onClick={() => setDraftKind('task')} className={triggerClasses}>
            <PlusIcon className="h-3.5 w-3.5" />
            {variant === 'labeled' && 'New Item'}
          </button>
        </Popover.Anchor>
      ) : (
        <Popover.Anchor>
          <Menu
            trigger={
              <button type="button" aria-label="Add" className={triggerClasses}>
                <PlusIcon className="h-3.5 w-3.5" />
                {variant === 'labeled' && 'New Item'}
              </button>
            }
            items={[
              { label: 'Task', onSelect: () => setDraftKind('task') },
              { label: 'Folder', onSelect: () => setDraftKind('folder') },
              ...(canAddProject ? [{ label: 'Project', onSelect: () => setProjectModalOpen(true) }] : []),
            ]}
          />
        </Popover.Anchor>
      )}

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="animate-pop-in bg-panel z-50 w-64 rounded-xl border border-white/10 p-2 shadow-xl shadow-black/40"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
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
                  // Stop this from also reaching Radix's own document-level
                  // Escape handler: that fires onOpenChange(false) -> submit()
                  // on the *pre-clear* state (state updates from discard()
                  // haven't flushed yet), which would re-create the item we
                  // just meant to throw away.
                  e.stopPropagation()
                  discard()
                }
              }}
              onBlur={submit}
              rows={2}
              placeholder={draftKind === 'folder' ? 'Folder name' : 'Task title'}
              className="input resize-none"
            />
          </form>
        </Popover.Content>
      </Popover.Portal>

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
    </Popover.Root>
  )
}
