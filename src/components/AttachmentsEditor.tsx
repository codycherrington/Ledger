import { useEffect, useRef, useState } from 'react'
import { getAttachmentBlob } from '../store/attachments'
import { formatBytes } from '../lib/format'
import { AttachmentIcon } from './icons'
import type { AttachmentMeta } from '../types'

interface AttachmentsEditorProps {
  attachments: AttachmentMeta[]
  onAdd: (file: File) => Promise<void>
  onRemove: (attachmentId: string) => Promise<void>
  /** Read-only display: attachments listed with a Download link, no upload/remove controls. */
  readOnly?: boolean
}

export default function AttachmentsEditor({ attachments, onAdd, onRemove, readOnly }: AttachmentsEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (readOnly) {
    if (attachments.length === 0) return <p className="text-xs text-slate-600">No attachments added.</p>
    return (
      <div className="space-y-2">
        {attachments.map((att) => (
          <AttachmentRow key={att.id} attachment={att} onRemove={onRemove} readOnly />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {attachments.map((att) => (
        <AttachmentRow key={att.id} attachment={att} onRemove={onRemove} />
      ))}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void onAdd(file)
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

function AttachmentRow({
  attachment,
  onRemove,
  readOnly,
}: {
  attachment: AttachmentMeta
  onRemove: (attachmentId: string) => Promise<void>
  readOnly?: boolean
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    getAttachmentBlob(attachment.id, { name: attachment.name, type: attachment.type }).then((file) => {
      if (file && !cancelled) {
        objectUrl = URL.createObjectURL(file)
        setUrl(objectUrl)
      }
    })
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
        <a href={url} download={attachment.name} className="shrink-0 text-xs font-medium text-indigo-400 hover:text-indigo-300">
          Download
        </a>
      )}
      {!readOnly && (
        <button type="button" onClick={() => void onRemove(attachment.id)} className="btn-danger-link shrink-0">
          Remove
        </button>
      )}
    </div>
  )
}
