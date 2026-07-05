import { useEffect, useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import Modal from './Modal'
import LinksEditor from './LinksEditor'
import AttachmentsEditor from './AttachmentsEditor'
import { COLOR_CLASSES, COLOR_NAMES, STATUS_COLOR, type ColorName } from '../lib/colors'
import { selectAllTags, selectOwnerColumns, useBoardStore } from '../store/board'
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

      <Field label="Summary" className="mt-5">
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
        <TagSection card={card} />
      </Field>

      <Field label="Checklist" className="mt-5">
        <ChecklistSection card={card} />
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
    </Modal>
  )
}

function Field({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <p className="mb-2 text-[11px] font-medium tracking-wide text-slate-500 uppercase">{label}</p>
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

function TagSection({ card }: { card: CardType }) {
  const tags = useBoardStore(useShallow(selectAllTags))
  const toggleCardTag = useBoardStore((s) => s.toggleCardTag)
  const createTag = useBoardStore((s) => s.createTag)
  const deleteTag = useBoardStore((s) => s.deleteTag)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState<ColorName>('blue')

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => {
          const active = card.tagIds.includes(tag.id)
          const cls = COLOR_CLASSES[tag.color as ColorName] ?? COLOR_CLASSES.slate
          return (
            <span
              key={tag.id}
              className={`group inline-flex items-center rounded-full border transition ${
                active
                  ? `${cls.bgSoft} ${cls.text} ${cls.border}`
                  : 'border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleCardTag(card.id, tag.id)}
                className="py-1 pr-1 pl-2.5 text-xs font-medium"
              >
                {tag.name}
              </button>
              {/* Tags are global now — deleting one affects every task, so it's
                  tucked behind hover and a confirm rather than a plain click. */}
              <button
                type="button"
                aria-label={`Delete ${tag.name} tag`}
                onClick={() => {
                  if (window.confirm(`Delete the "${tag.name}" tag? It will be removed from every task.`)) deleteTag(tag.id)
                }}
                className="pr-2 pl-0.5 text-sm leading-none opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
              >
                ×
              </button>
            </span>
          )
        })}
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="rounded-full border border-dashed border-white/15 px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:border-white/30 hover:text-slate-300"
        >
          + New tag
        </button>
      </div>
      {adding && (
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tag name"
            className="input w-40 px-2.5 py-1.5"
          />
          <div className="flex gap-1.5">
            {COLOR_NAMES.slice(0, 8).map((c) => (
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
          <button
            type="button"
            onClick={() => {
              if (!name.trim()) return
              const id = createTag(name.trim(), color)
              toggleCardTag(card.id, id)
              setName('')
              setAdding(false)
            }}
            className="btn-primary px-2.5 py-1.5 text-xs"
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}

function ChecklistSection({ card }: { card: CardType }) {
  const addItem = useBoardStore((s) => s.addChecklistItem)
  const toggleItem = useBoardStore((s) => s.toggleChecklistItem)
  const removeItem = useBoardStore((s) => s.removeChecklistItem)
  const [text, setText] = useState('')

  const done = card.checklist.filter((i) => i.done).length
  const total = card.checklist.length

  return (
    <div>
      {total > 0 && (
        <div className="mb-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            {done}/{total} complete
          </p>
        </div>
      )}
      <div className="space-y-1.5">
        {card.checklist.map((item) => (
          <div key={item.id} className="group flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => toggleItem(card.id, item.id)}
              className="h-4 w-4 rounded accent-indigo-500"
            />
            <span className={`flex-1 text-sm ${item.done ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
              {item.text}
            </span>
            <button
              type="button"
              onClick={() => removeItem(card.id, item.id)}
              className="btn-danger-link opacity-0 transition group-hover:opacity-100"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          addItem(card.id, text.trim())
          setText('')
        }}
        className="mt-2.5 flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add checklist item"
          className="input flex-1 px-2.5 py-1.5"
        />
        <button type="submit" className="btn-primary px-2.5 py-1.5 text-xs">
          Add
        </button>
      </form>
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
