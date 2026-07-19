import { useEffect, useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import Modal from './Modal'
import LinksEditor from './LinksEditor'
import AttachmentsEditor from './AttachmentsEditor'
import TagPicker from './TagPicker'
import CopyButton from './CopyButton'
import { COLOR_CLASSES, STATUS_COLOR } from '../lib/colors'
import { selectOwnerColumns, useBoardStore } from '../store/board'
import { buildTaskPrompt } from '../lib/claudeCode'
import type { Card as CardType, Priority } from '../types'

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'med', label: 'Medium' },
  { value: 'high', label: 'High' },
]

interface CardDetailDialogProps {
  cardId: string
  onClose: () => void
}

export default function CardDetailDialog({ cardId, onClose }: CardDetailDialogProps) {
  const card = useBoardStore((s) => s.cards[cardId])
  const updateCard = useBoardStore((s) => s.updateCard)
  const deleteCard = useBoardStore((s) => s.deleteCard)
  const toggleCardTag = useBoardStore((s) => s.toggleCardTag)
  const project = useBoardStore((s) => (card?.projectId ? s.projects[card.projectId] : undefined))
  const startClaudeCode = useBoardStore((s) => s.startClaudeCode)

  const [title, setTitle] = useState(card?.title ?? '')
  const [summary, setSummary] = useState(card?.summary ?? '')

  useEffect(() => {
    setTitle(card?.title ?? '')
    setSummary(card?.summary ?? '')
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

  function handleDelete() {
    if (window.confirm(`Delete "${card!.title}"?`)) {
      deleteCard(card!.id)
      onClose()
    }
  }

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={card.title} size="lg" hideVisualTitle>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        className="-mt-8 mb-5 w-full rounded-lg border border-transparent px-1.5 py-1 text-lg font-semibold text-slate-100 transition hover:border-white/10 focus:border-indigo-400/50 focus:outline-none"
      />

      <div className="grid grid-cols-3 gap-4">
        <Field label="Status">
          <StatusSection card={card} />
        </Field>
        <Field label="Priority">
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
        </Field>
        <Field label="Due date">
          <input
            type="date"
            value={card.dueDate ?? ''}
            onChange={(e) => updateCard(card.id, { dueDate: e.target.value || undefined })}
            className="input w-auto px-2.5 py-1.5 [color-scheme:dark]"
          />
        </Field>
      </div>

      <Field label="Summary" className="mt-5" action={summary.trim() && <CopyButton text={summary} label="Copy summary" />}>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onBlur={commitSummary}
          rows={3}
          placeholder="What is this task about?"
          className="input resize-none"
        />
      </Field>

      <Field label="Tags" className="mt-5">
        <TagPicker activeTagIds={card.tagIds} onToggle={(tagId) => toggleCardTag(card.id, tagId)} />
      </Field>

      <Field label="Resources" className="mt-5">
        <CardLinksSection card={card} />
      </Field>

      <Field label="Attachments" className="mt-5">
        <CardAttachmentsSection card={card} />
      </Field>

      <div className="mt-7 flex items-center justify-between border-t border-white/[0.06] pt-4">
        <button type="button" onClick={handleDelete} className="btn-danger-link">
          Delete card
        </button>
        <div className="flex items-center gap-2">
          {project && project.claudeCodeEnabled && project.repoPath && (
            <button
              type="button"
              onClick={() => startClaudeCode(project.repoPath!, buildTaskPrompt([card]))}
              className="rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/30"
            >
              Start with Claude
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              commitTitle()
              commitSummary()
              onClose()
            }}
            className="btn-primary"
          >
            Save
          </button>
        </div>
      </div>
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

function StatusSection({ card }: { card: CardType }) {
  // A task's 4 status options come from whichever board it (or its folder,
  // if filed) ultimately belongs to: the project's board if it has one, or
  // Home's board for a standalone task.
  const columns = useBoardStore(
    useShallow((s) => selectOwnerColumns(s, card.projectId ? 'project' : 'home', card.projectId)),
  )
  const setCardStatus = useBoardStore((s) => s.setCardStatus)

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

function CardLinksSection({ card }: { card: CardType }) {
  const addLink = useBoardStore((s) => s.addLink)
  const updateLink = useBoardStore((s) => s.updateLink)
  const removeLink = useBoardStore((s) => s.removeLink)

  return (
    <LinksEditor
      links={card.links}
      onAdd={(label, url) => addLink(card.id, label, url)}
      onUpdate={(linkId, patch) => updateLink(card.id, linkId, patch)}
      onRemove={(linkId) => removeLink(card.id, linkId)}
    />
  )
}

function CardAttachmentsSection({ card }: { card: CardType }) {
  const addAttachment = useBoardStore((s) => s.addAttachment)
  const removeAttachment = useBoardStore((s) => s.removeAttachment)

  return (
    <AttachmentsEditor
      attachments={card.attachments}
      onAdd={(file) => addAttachment(card.id, file)}
      onRemove={(attachmentId) => removeAttachment(card.id, attachmentId)}
    />
  )
}
