import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import Modal from './Modal'
import { COLOR_CLASSES, COLOR_NAMES, type ColorName } from '../lib/colors'
import { selectProjectTags, useBoardStore } from '../store/board'
import { getAttachmentBlob } from '../store/attachments'
import { formatBytes } from '../lib/format'
import { safeHref } from '../lib/links'
import { AttachmentIcon, LinkIcon } from './icons'
import type { AttachmentMeta, Card as CardType, Priority } from '../types'

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

      <div className="grid grid-cols-2 gap-4">
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
        <LinksSection card={card} />
      </Field>

      <Field label="Attachments" className="mt-5">
        <AttachmentsSection card={card} />
      </Field>

      <div className="mt-7 border-t border-white/[0.06] pt-4">
        <button type="button" onClick={handleDelete} className="btn-danger-link">
          Delete card
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

function TagSection({ card }: { card: CardType }) {
  const tags = useBoardStore(useShallow((s) => selectProjectTags(s, card.projectId)))
  const toggleCardTag = useBoardStore((s) => s.toggleCardTag)
  const createTag = useBoardStore((s) => s.createTag)
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
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleCardTag(card.id, tag.id)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                active
                  ? `${cls.bgSoft} ${cls.text} ${cls.border}`
                  : 'border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300'
              }`}
            >
              {tag.name}
            </button>
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
              const id = createTag(card.projectId, name.trim(), color)
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

function LinksSection({ card }: { card: CardType }) {
  const addLink = useBoardStore((s) => s.addLink)
  const updateLink = useBoardStore((s) => s.updateLink)
  const removeLink = useBoardStore((s) => s.removeLink)
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')

  return (
    <div className="space-y-2">
      {card.links.map((link) => {
        const href = safeHref(link.url)
        return (
          <div key={link.id} className="flex items-center gap-2">
            <LinkIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <input
              value={link.label}
              onChange={(e) => updateLink(card.id, link.id, { label: e.target.value })}
              className="input w-32 shrink-0 px-2.5 py-1.5"
            />
            <input
              value={link.url}
              onChange={(e) => updateLink(card.id, link.id, { url: e.target.value })}
              className="input flex-1 px-2.5 py-1.5"
            />
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs font-medium text-indigo-400 hover:text-indigo-300"
              >
                Open
              </a>
            )}
            <button
              type="button"
              onClick={() => removeLink(card.id, link.id)}
              className="btn-danger-link shrink-0"
            >
              Remove
            </button>
          </div>
        )
      })}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!url.trim()) return
          addLink(card.id, label.trim() || url.trim(), url.trim())
          setLabel('')
          setUrl('')
        }}
        className="flex items-center gap-2"
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label"
          className="input w-32 shrink-0 px-2.5 py-1.5"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="input flex-1 px-2.5 py-1.5"
        />
        <button type="submit" className="btn-primary shrink-0 px-2.5 py-1.5 text-xs">
          Add
        </button>
      </form>
    </div>
  )
}

function AttachmentsSection({ card }: { card: CardType }) {
  const addAttachment = useBoardStore((s) => s.addAttachment)
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-2">
      {card.attachments.map((att) => (
        <AttachmentRow key={att.id} cardId={card.id} attachment={att} />
      ))}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void addAttachment(card.id, file)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="rounded-lg border border-dashed border-white/15 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-white/30 hover:text-slate-300"
      >
        + Upload file
      </button>
    </div>
  )
}

function AttachmentRow({ cardId, attachment }: { cardId: string; attachment: AttachmentMeta }) {
  const removeAttachment = useBoardStore((s) => s.removeAttachment)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    getAttachmentBlob(attachment.id, { name: attachment.name, type: attachment.type }).then(
      (file) => {
        if (file && !cancelled) {
          objectUrl = URL.createObjectURL(file)
          setUrl(objectUrl)
        }
      },
    )
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachment.id, attachment.name, attachment.type])

  const isImage = attachment.type.startsWith('image/')

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
      {isImage && url ? (
        <img src={url} alt={attachment.name} className="h-10 w-10 rounded-lg object-cover" />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.05] text-slate-500">
          <AttachmentIcon className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-slate-200">{attachment.name}</p>
        <p className="text-xs text-slate-500">{formatBytes(attachment.size)}</p>
      </div>
      {url && (
        <a
          href={url}
          download={attachment.name}
          className="shrink-0 text-xs font-medium text-indigo-400 hover:text-indigo-300"
        >
          Download
        </a>
      )}
      <button
        type="button"
        onClick={() => void removeAttachment(cardId, attachment.id)}
        className="btn-danger-link shrink-0"
      >
        Remove
      </button>
    </div>
  )
}
