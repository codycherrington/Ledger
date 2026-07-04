import { useState } from 'react'
import Modal from './Modal'

interface ProjectFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  submitLabel: string
  initialName?: string
  initialDescription?: string
  onSubmit: (name: string, description?: string) => void
}

export default function ProjectFormModal({
  open,
  onOpenChange,
  title,
  submitLabel,
  initialName,
  initialDescription,
  onSubmit,
}: ProjectFormModalProps) {
  const [name, setName] = useState(initialName ?? '')
  const [description, setDescription] = useState(initialDescription ?? '')

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (next) {
          setName(initialName ?? '')
          setDescription(initialDescription ?? '')
        }
      }}
      title={title}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          onSubmit(name.trim(), description.trim() || undefined)
        }}
      >
        <label className="block text-sm font-medium text-slate-300">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input mt-1.5"
          placeholder="e.g. Website Redesign"
        />
        <label className="mt-4 block text-sm font-medium text-slate-300">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="input mt-1.5 resize-none"
        />
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={!name.trim()} className="btn-primary">
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}
