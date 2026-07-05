import { useState } from 'react'
import { useSaveStatusStore } from '../store/saveStatus'

const GREEN_GLOW = 'bg-emerald-400 shadow-[0_0_8px_2px] shadow-emerald-400/60'

const DOT_CLASSES: Record<string, string> = {
  idle: GREEN_GLOW,
  saving: 'bg-amber-400 shadow-[0_0_8px_2px] shadow-amber-400/60',
  saved: GREEN_GLOW,
  error: 'bg-rose-500 shadow-[0_0_8px_2px] shadow-rose-500/60',
}

const LABEL: Record<string, string> = {
  idle: 'Saved',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
}

export default function SaveStatusLight() {
  const status = useSaveStatusStore((s) => s.status)
  const error = useSaveStatusStore((s) => s.error)
  const [copied, setCopied] = useState(false)

  const dot = <span className={`block h-2.5 w-2.5 rounded-full transition-colors ${DOT_CLASSES[status]}`} />

  if (status !== 'error') {
    return (
      <div className="no-drag flex items-center" title={LABEL[status]}>
        {dot}
      </div>
    )
  }

  function handleCopy() {
    if (!error) return
    navigator.clipboard.writeText(error)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="no-drag group relative flex items-center">
      {dot}
      <div className="animate-pop-in bg-overlay pointer-events-none absolute top-full right-0 z-50 mt-2 w-80 rounded-xl border border-white/10 p-3.5 opacity-0 shadow-xl shadow-black/40 transition group-hover:pointer-events-auto group-hover:opacity-100">
        <p className="text-xs font-medium text-rose-400">Save failed</p>
        <p className="mt-1.5 max-h-40 overflow-y-auto text-xs whitespace-pre-wrap text-slate-300">{error}</p>
        <button type="button" onClick={handleCopy} className="btn-ghost mt-3 text-xs">
          {copied ? 'Copied' : 'Copy for AI'}
        </button>
      </div>
    </div>
  )
}
