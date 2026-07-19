import { useState } from 'react'
import { CheckIcon, CopyIcon } from './icons'

interface CopyButtonProps {
  text: string
  label: string
}

export default function CopyButton({ text, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button type="button" onClick={handleCopy} aria-label={label} title={label} className="icon-btn">
      {copied ? <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> : <CopyIcon className="h-3.5 w-3.5" />}
    </button>
  )
}
