import { useEffect, useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import Modal from './Modal'
import LinksEditor from './LinksEditor'
import AttachmentsEditor from './AttachmentsEditor'
import TagPicker from './TagPicker'
import CopyButton from './CopyButton'
import { COLOR_CLASSES, COLOR_NAMES, PRIORITY_COLOR, type ColorName } from '../lib/colors'
import { formatDueDate, isDueToday, isOverdue } from '../lib/dates'
import { buildTaskPrompt } from '../lib/claudeCode'
import { selectAllTags, selectFolderTasks, useBoardStore } from '../store/board'
import type { Folder, Priority } from '../types'

const PRIORITY_LABEL: Record<Priority, string> = { low: 'Low', med: 'Medium', high: 'High' }

interface FolderDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folder: Folder
  // Opens straight into edit mode — used right after creating a folder from
  // GlobalAddButton, so the user can immediately type over the seeded name.
  startInEditMode?: boolean
}

export default function FolderDetailDialog({ open, onOpenChange, folder, startInEditMode }: FolderDetailDialogProps) {
  const updateFolder = useBoardStore((s) => s.updateFolder)
  const deleteFolder = useBoardStore((s) => s.deleteFolder)
  const toggleFolderTag = useBoardStore((s) => s.toggleFolderTag)
  const addFolderLink = useBoardStore((s) => s.addFolderLink)
  const updateFolderLink = useBoardStore((s) => s.updateFolderLink)
  const removeFolderLink = useBoardStore((s) => s.removeFolderLink)
  const addFolderAttachment = useBoardStore((s) => s.addFolderAttachment)
  const removeFolderAttachment = useBoardStore((s) => s.removeFolderAttachment)
  const ownerProject = useBoardStore((s) => (folder.ownerType === 'project' ? s.projects[folder.ownerId ?? ''] : undefined))
  const folderTasks = useBoardStore(useShallow((s) => selectFolderTasks(s, folder.id)))
  const startClaudeCode = useBoardStore((s) => s.startClaudeCode)

  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [name, setName] = useState(folder.name)
  const [description, setDescription] = useState(folder.description ?? '')
  const [color, setColor] = useState<ColorName>((folder.color as ColorName) ?? 'slate')
  const [priority, setPriority] = useState<Priority | undefined>(folder.priority)
  const [dueDate, setDueDate] = useState(folder.dueDate ?? '')

  useEffect(() => {
    if (open) {
      setName(folder.name)
      setDescription(folder.description ?? '')
      setColor((folder.color as ColorName) ?? 'slate')
      setPriority(folder.priority)
      setDueDate(folder.dueDate ?? '')
      setMode(startInEditMode ? 'edit' : 'view')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, folder.id])

  function handleSave() {
    if (name.trim()) {
      updateFolder(folder.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        priority,
        dueDate: dueDate || undefined,
      })
    }
    setMode('view')
  }

  function handleDelete() {
    if (window.confirm(`Delete "${folder.name}"? Its tasks will move back to the board.`)) {
      deleteFolder(folder.id)
      onOpenChange(false)
    }
  }

  const canStartClaude = ownerProject && ownerProject.claudeCodeEnabled && ownerProject.repoPath
  const claudePrompt = [folder.description, buildTaskPrompt(folderTasks)].filter(Boolean).join('\n\n')

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onOpenChange(false)}
      title={folder.name}
      size="lg"
      hideVisualTitle
      headerAction={
        mode === 'view' && (
          <button type="button" onClick={() => setMode('edit')} className="btn-ghost">
            Edit
          </button>
        )
      }
      footer={
        <div className="flex items-center justify-between">
          {mode === 'view' ? (
            canStartClaude ? (
              <button
                type="button"
                onClick={() => startClaudeCode(ownerProject.repoPath!, claudePrompt)}
                className="rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/30"
              >
                Start with Claude Code
              </button>
            ) : (
              <span />
            )
          ) : (
            <button type="button" onClick={handleDelete} className="btn-danger">
              Delete
            </button>
          )}
          {mode === 'view' ? (
            <button type="button" onClick={() => onOpenChange(false)} className="btn-primary">
              Done
            </button>
          ) : (
            <button type="button" onClick={handleSave} disabled={!name.trim()} className="btn-primary">
              Save
            </button>
          )}
        </div>
      }
    >
      {mode === 'edit' ? (
        <input
          autoFocus
          onFocus={(e) => e.target.select()}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Phase 1"
          className="mb-5 w-full rounded-lg border border-transparent px-1.5 py-1 text-lg font-semibold text-slate-100 transition hover:border-white/10 focus:border-indigo-400/50 focus:outline-none"
        />
      ) : (
        <p className="mb-5 px-1.5 py-1 text-lg font-semibold text-slate-100">{folder.name}</p>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Field label="Priority">
          {mode === 'edit' ? (
            <div className="flex gap-1.5">
              {(['low', 'med', 'high'] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(priority === p ? undefined : p)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                    priority === p
                      ? 'border-indigo-400/40 bg-indigo-500/20 text-indigo-300'
                      : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300'
                  }`}
                >
                  {PRIORITY_LABEL[p]}
                </button>
              ))}
            </div>
          ) : folder.priority ? (
            <span
              className={`inline-block rounded-lg border px-2.5 py-1 text-xs font-medium ${COLOR_CLASSES[PRIORITY_COLOR[folder.priority]].bgSoft} ${COLOR_CLASSES[PRIORITY_COLOR[folder.priority]].text} ${COLOR_CLASSES[PRIORITY_COLOR[folder.priority]].border}`}
            >
              {PRIORITY_LABEL[folder.priority]}
            </span>
          ) : (
            <p className="text-xs text-slate-600">No priority</p>
          )}
        </Field>
        <Field label="Due date">
          {mode === 'edit' ? (
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="input w-auto px-2.5 py-1.5 [color-scheme:dark]"
            />
          ) : folder.dueDate ? (
            <p
              className={`text-sm font-medium ${
                isOverdue(folder.dueDate) ? 'text-rose-300' : isDueToday(folder.dueDate) ? 'text-amber-300' : 'text-slate-300'
              }`}
            >
              {formatDueDate(folder.dueDate)}
            </p>
          ) : (
            <p className="text-xs text-slate-600">No due date</p>
          )}
        </Field>
        <Field label="Color">
          {mode === 'edit' ? (
            <div className="flex flex-wrap gap-1.5">
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
          ) : (
            <div className="flex items-center gap-1.5">
              <span className={`h-3.5 w-3.5 rounded-full ${(COLOR_CLASSES[folder.color as ColorName] ?? COLOR_CLASSES.slate).dot}`} />
              <span className="text-sm text-slate-300 capitalize">{folder.color}</span>
            </div>
          )}
        </Field>
      </div>

      <Field label="Description" className="mt-5" action={description.trim() && <CopyButton text={description} label="Copy description" />}>
        {mode === 'edit' ? (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={8}
            placeholder="What is this folder about?"
            className="input resize-none"
          />
        ) : folder.description?.trim() ? (
          <p className="text-sm whitespace-pre-wrap text-slate-300">{folder.description}</p>
        ) : (
          <p className="text-xs text-slate-600">No description added.</p>
        )}
      </Field>

      <Field label="Tags" className="mt-5">
        {mode === 'edit' ? (
          <TagPicker activeTagIds={folder.tagIds} onToggle={(tagId) => toggleFolderTag(folder.id, tagId)} />
        ) : (
          <FolderTagsView folder={folder} />
        )}
      </Field>

      <Field label="Resources" className="mt-5">
        <LinksEditor
          links={folder.links}
          onAdd={(label, url) => addFolderLink(folder.id, label, url)}
          onUpdate={(linkId, patch) => updateFolderLink(folder.id, linkId, patch)}
          onRemove={(linkId) => removeFolderLink(folder.id, linkId)}
          readOnly={mode === 'view'}
        />
      </Field>

      <Field label="Attachments" className="mt-5">
        <AttachmentsEditor
          attachments={folder.attachments}
          onAdd={(file) => addFolderAttachment(folder.id, file)}
          onRemove={(attachmentId) => removeFolderAttachment(folder.id, attachmentId)}
          readOnly={mode === 'view'}
        />
      </Field>
    </Modal>
  )
}

function Field({
  label,
  className = '',
  action,
  children,
}: {
  label: string
  className?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">{label}</p>
        {action}
      </div>
      {children}
    </div>
  )
}

function FolderTagsView({ folder }: { folder: Folder }) {
  const allTags = useBoardStore(useShallow(selectAllTags))
  const tags = allTags.filter((t) => folder.tagIds.includes(t.id))
  if (tags.length === 0) return <p className="text-xs text-slate-600">No tags</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const cls = COLOR_CLASSES[tag.color as ColorName] ?? COLOR_CLASSES.slate
        return (
          <span key={tag.id} className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls.bgSoft} ${cls.text}`}>
            {tag.name}
          </span>
        )
      })}
    </div>
  )
}
