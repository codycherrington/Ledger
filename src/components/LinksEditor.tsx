import { useState } from 'react'
import { safeHref } from '../lib/links'
import { LinkIcon } from './icons'
import type { ResourceLink } from '../types'

interface LinksEditorProps {
  links: ResourceLink[]
  onAdd: (label: string, url: string) => void
  onUpdate: (linkId: string, patch: Partial<Pick<ResourceLink, 'label' | 'url'>>) => void
  onRemove: (linkId: string) => void
  /** Read-only display: just the link list with an "Open" action, no editing controls. */
  readOnly?: boolean
}

export default function LinksEditor({ links, onAdd, onUpdate, onRemove, readOnly }: LinksEditorProps) {
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')

  if (readOnly) {
    if (links.length === 0) return <p className="text-xs text-slate-600">No resources added.</p>
    return (
      <div className="space-y-1.5">
        {links.map((link) => {
          const href = safeHref(link.url)
          return (
            <div key={link.id} className="flex items-center gap-2 text-sm">
              <LinkIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-indigo-400 hover:text-indigo-300 hover:underline"
                >
                  {link.label || link.url}
                </a>
              ) : (
                <span className="truncate text-slate-300">{link.label || link.url}</span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {links.map((link) => {
        const href = safeHref(link.url)
        return (
          <div key={link.id} className="flex items-center gap-2">
            <LinkIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <input
              value={link.label}
              onChange={(e) => onUpdate(link.id, { label: e.target.value })}
              className="input w-32 shrink-0 px-2.5 py-1.5"
            />
            <input
              value={link.url}
              onChange={(e) => onUpdate(link.id, { url: e.target.value })}
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
            <button type="button" onClick={() => onRemove(link.id)} className="btn-danger-link shrink-0">
              Remove
            </button>
          </div>
        )
      })}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!url.trim()) return
          onAdd(label.trim() || url.trim(), url.trim())
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
