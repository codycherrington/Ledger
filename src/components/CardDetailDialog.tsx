import { useEffect, useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import Modal from './Modal'
import Menu from './Menu'
import LinksEditor from './LinksEditor'
import AttachmentsEditor from './AttachmentsEditor'
import TagPicker from './TagPicker'
import CopyButton from './CopyButton'
import { COLOR_CLASSES, PRIORITY_COLOR, STATUS_COLOR, type ColorName } from '../lib/colors'
import { formatDueDate, isDueToday, isOverdue } from '../lib/dates'
import { selectAllTags, selectOwnerColumns, useBoardStore } from '../store/board'
import { buildTaskPrompt } from '../lib/claudeCode'
import type { Card as CardType, Folder, Priority } from '../types'

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'med', label: 'Medium' },
  { value: 'high', label: 'High' },
]
const PRIORITY_LABEL: Record<Priority, string> = { low: 'Low', med: 'Medium', high: 'High' }

interface CardDetailDialogProps {
  cardId: string
  onClose: () => void
  // Opens straight into edit mode — used right after creating a card from
  // GlobalAddButton, so the user can immediately type over the seeded title.
  startInEditMode?: boolean
}

export default function CardDetailDialog({ cardId, onClose, startInEditMode }: CardDetailDialogProps) {
  const card = useBoardStore((s) => s.cards[cardId])
  const updateCard = useBoardStore((s) => s.updateCard)
  const deleteCard = useBoardStore((s) => s.deleteCard)
  const toggleCardTag = useBoardStore((s) => s.toggleCardTag)
  const project = useBoardStore((s) => (card?.projectId ? s.projects[card.projectId] : undefined))
  const startClaudeCode = useBoardStore((s) => s.startClaudeCode)

  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [title, setTitle] = useState(card?.title ?? '')
  const [summary, setSummary] = useState(card?.summary ?? '')

  useEffect(() => {
    setTitle(card?.title ?? '')
    setSummary(card?.summary ?? '')
    setMode(startInEditMode ? 'edit' : 'view')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id, card?.title, card?.summary])

  if (!card) return null

  function commitTitle() {
    const t = title.trim()
    if (t && t !== card!.title) updateCard(card!.id, { title: t })
    else if (!t) setTitle(card!.title)
  }

  function commitSummary() {
    if (summary !== (card!.summary ?? '')) updateCard(card!.id, { summary: summary || undefined })
  }

  function handleSave() {
    commitTitle()
    commitSummary()
    setMode('view')
  }

  function handleDelete() {
    if (window.confirm(`Delete "${card!.title}"?`)) {
      deleteCard(card!.id)
      onClose()
    }
  }

  const canStartClaude = project && project.claudeCodeEnabled && project.repoPath

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={card.title}
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
                onClick={() => startClaudeCode(project.repoPath!, buildTaskPrompt([card]))}
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
            <button type="button" onClick={onClose} className="btn-primary">
              Done
            </button>
          ) : (
            <button type="button" onClick={handleSave} className="btn-primary">
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
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          className="mb-5 w-full rounded-lg border border-transparent px-1.5 py-1 text-lg font-semibold text-slate-100 transition hover:border-white/10 focus:border-indigo-400/50 focus:outline-none"
        />
      ) : (
        <p className="mb-5 px-1.5 py-1 text-lg font-semibold text-slate-100">{card.title}</p>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Field label="Status">
          <StatusSection card={card} readOnly={mode === 'view'} />
        </Field>
        <Field label="Priority">
          {mode === 'edit' ? (
            <div className="flex gap-1.5">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => updateCard(card.id, { priority: card.priority === p.value ? undefined : p.value })}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                    card.priority === p.value
                      ? 'border-indigo-400/40 bg-indigo-500/20 text-indigo-300'
                      : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          ) : card.priority ? (
            <span
              className={`inline-block rounded-lg border px-2.5 py-1 text-xs font-medium ${COLOR_CLASSES[PRIORITY_COLOR[card.priority]].bgSoft} ${COLOR_CLASSES[PRIORITY_COLOR[card.priority]].text} ${COLOR_CLASSES[PRIORITY_COLOR[card.priority]].border}`}
            >
              {PRIORITY_LABEL[card.priority]}
            </span>
          ) : (
            <p className="text-xs text-slate-600">No priority</p>
          )}
        </Field>
        <Field label="Due date">
          {mode === 'edit' ? (
            <input
              type="date"
              value={card.dueDate ?? ''}
              onChange={(e) => updateCard(card.id, { dueDate: e.target.value || undefined })}
              className="input w-auto px-2.5 py-1.5 [color-scheme:dark]"
            />
          ) : card.dueDate ? (
            <p
              className={`text-sm font-medium ${
                isOverdue(card.dueDate) ? 'text-rose-300' : isDueToday(card.dueDate) ? 'text-amber-300' : 'text-slate-300'
              }`}
            >
              {formatDueDate(card.dueDate)}
            </p>
          ) : (
            <p className="text-xs text-slate-600">No due date</p>
          )}
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Project">
          <CardProjectField card={card} readOnly={mode === 'view'} />
        </Field>
        <Field label="Folder">
          <CardFolderField card={card} readOnly={mode === 'view'} />
        </Field>
      </div>

      <Field label="Summary" className="mt-5" action={summary.trim() && <CopyButton text={summary} label="Copy summary" />}>
        {mode === 'edit' ? (
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            onBlur={commitSummary}
            rows={8}
            placeholder="What is this task about?"
            className="input resize-none"
          />
        ) : card.summary?.trim() ? (
          <p className="text-sm whitespace-pre-wrap text-slate-300">{card.summary}</p>
        ) : (
          <p className="text-xs text-slate-600">No summary added.</p>
        )}
      </Field>

      <Field label="Tags" className="mt-5">
        {mode === 'edit' ? (
          <TagPicker activeTagIds={card.tagIds} onToggle={(tagId) => toggleCardTag(card.id, tagId)} />
        ) : (
          <CardTagsView card={card} />
        )}
      </Field>

      <Field label="Resources" className="mt-5">
        <CardLinksSection card={card} readOnly={mode === 'view'} />
      </Field>

      <Field label="Attachments" className="mt-5">
        <CardAttachmentsSection card={card} readOnly={mode === 'view'} />
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

function StatusSection({ card, readOnly }: { card: CardType; readOnly?: boolean }) {
  // A task's 4 status options come from whichever board it (or its folder,
  // if filed) ultimately belongs to: the project's board if it has one, or
  // Home's board for a standalone task.
  const columns = useBoardStore(
    useShallow((s) => selectOwnerColumns(s, card.projectId ? 'project' : 'home', card.projectId)),
  )
  const setCardStatus = useBoardStore((s) => s.setCardStatus)

  if (readOnly) {
    const col = columns.find((c) => c.id === card.columnId)
    if (!col) return <p className="text-xs text-slate-600">—</p>
    const cls = COLOR_CLASSES[STATUS_COLOR[col.name] ?? 'slate']
    return (
      <span className={`inline-block rounded-lg border px-2.5 py-1 text-xs font-medium ${cls.bgSoft} ${cls.text} ${cls.border}`}>
        {col.name}
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {columns.map((col) => {
        const active = card.columnId === col.id
        const cls = COLOR_CLASSES[STATUS_COLOR[col.name] ?? 'slate']
        return (
          <button
            key={col.id}
            type="button"
            onClick={() => setCardStatus(card.id, col.id)}
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
              active ? `${cls.bgSoft} ${cls.text} ${cls.border}` : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300'
            }`}
          >
            {col.name}
          </button>
        )
      })}
    </div>
  )
}

const pickerTriggerClasses =
  'max-w-full truncate rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-white/20 hover:text-slate-100'

function CardProjectField({ card, readOnly }: { card: CardType; readOnly?: boolean }) {
  const projects = useBoardStore(useShallow((s) => Object.values(s.projects)))
  const moveTaskToProject = useBoardStore((s) => s.moveTaskToProject)
  const current = projects.find((p) => p.id === card.projectId)

  if (readOnly) {
    return <p className={current ? 'text-sm text-slate-300' : 'text-xs text-slate-600'}>{current?.name ?? 'None'}</p>
  }

  return (
    <Menu
      trigger={
        <button type="button" className={pickerTriggerClasses}>
          {current?.name ?? 'None'}
        </button>
      }
      items={[
        { label: 'None', onSelect: () => moveTaskToProject(card.id, undefined) },
        ...projects.map((p) => ({ label: p.name, onSelect: () => moveTaskToProject(card.id, p.id) })),
      ]}
    />
  )
}

function folderOwnerLabel(folder: Folder, projects: Record<string, { name: string }>): string {
  if (folder.ownerType === 'home') return 'Home'
  return projects[folder.ownerId ?? '']?.name ?? 'Project'
}

function CardFolderField({ card, readOnly }: { card: CardType; readOnly?: boolean }) {
  const folders = useBoardStore(useShallow((s) => Object.values(s.folders)))
  const projects = useBoardStore(useShallow((s) => s.projects))
  const fileTaskInFolder = useBoardStore((s) => s.fileTaskInFolder)
  const unfileTaskFromFolder = useBoardStore((s) => s.unfileTaskFromFolder)
  const current = folders.find((f) => f.id === card.folderId)
  const currentLabel = current ? `${current.name} — ${folderOwnerLabel(current, projects)}` : 'None'

  if (readOnly) {
    return <p className={current ? 'text-sm text-slate-300' : 'text-xs text-slate-600'}>{currentLabel}</p>
  }

  function unfile() {
    if (!card.folderId) return
    const column = useBoardStore.getState().columns[card.columnId]
    unfileTaskFromFolder(card.id, card.columnId, column ? column.cardOrder.length : 0)
  }

  return (
    <Menu
      trigger={
        <button type="button" className={pickerTriggerClasses}>
          {currentLabel}
        </button>
      }
      items={[
        { label: 'None', onSelect: unfile },
        ...folders.map((f) => ({
          label: `${f.name} — ${folderOwnerLabel(f, projects)}`,
          onSelect: () => fileTaskInFolder(card.id, f.id, f.taskIds.length),
        })),
      ]}
    />
  )
}

function CardTagsView({ card }: { card: CardType }) {
  const allTags = useBoardStore(useShallow(selectAllTags))
  const tags = allTags.filter((t) => card.tagIds.includes(t.id))
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

function CardLinksSection({ card, readOnly }: { card: CardType; readOnly?: boolean }) {
  const addLink = useBoardStore((s) => s.addLink)
  const updateLink = useBoardStore((s) => s.updateLink)
  const removeLink = useBoardStore((s) => s.removeLink)

  return (
    <LinksEditor
      links={card.links}
      onAdd={(label, url) => addLink(card.id, label, url)}
      onUpdate={(linkId, patch) => updateLink(card.id, linkId, patch)}
      onRemove={(linkId) => removeLink(card.id, linkId)}
      readOnly={readOnly}
    />
  )
}

function CardAttachmentsSection({ card, readOnly }: { card: CardType; readOnly?: boolean }) {
  const addAttachment = useBoardStore((s) => s.addAttachment)
  const removeAttachment = useBoardStore((s) => s.removeAttachment)

  return (
    <AttachmentsEditor
      attachments={card.attachments}
      onAdd={(file) => addAttachment(card.id, file)}
      onRemove={(attachmentId) => removeAttachment(card.id, attachmentId)}
      readOnly={readOnly}
    />
  )
}
