import { useEffect, useState } from 'react'
import { useSaveStatusStore } from '../store/saveStatus'

export default function SaveIndicator() {
  const status = useSaveStatusStore((s) => s.status)
  const savedAt = useSaveStatusStore((s) => s.savedAt)
  const [showSaved, setShowSaved] = useState(false)

  useEffect(() => {
    if (status !== 'saved') return
    setShowSaved(true)
    const t = setTimeout(() => setShowSaved(false), 2000)
    return () => clearTimeout(t)
  }, [status, savedAt])

  if (status === 'saving') {
    return <span className="no-drag text-xs text-slate-500">Saving…</span>
  }
  if (status === 'error') {
    return <span className="no-drag text-xs text-rose-400">Save failed</span>
  }
  if (status === 'saved' && showSaved) {
    return <span className="no-drag text-xs text-emerald-400">Saved</span>
  }
  return null
}
