import { useEffect, useState, type ReactNode } from 'react'
import Modal from './Modal'
import LinksEditor from './LinksEditor'
import AttachmentsEditor from './AttachmentsEditor'
import { useBoardStore } from '../store/board'

interface ProjectDetailDialogProps {
  projectId: string
  onClose: () => void
}

export default function ProjectDetailDialog({ projectId, onClose }: ProjectDetailDialogProps) {
  const project = useBoardStore((s) => s.projects[projectId])
  const updateProject = useBoardStore((s) => s.updateProject)
  const deleteProject = useBoardStore((s) => s.deleteProject)
  const addProjectLink = useBoardStore((s) => s.addProjectLink)
  const updateProjectLink = useBoardStore((s) => s.updateProjectLink)
  const removeProjectLink = useBoardStore((s) => s.removeProjectLink)
  const addProjectAttachment = useBoardStore((s) => s.addProjectAttachment)
  const removeProjectAttachment = useBoardStore((s) => s.removeProjectAttachment)

  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')

  useEffect(() => {
    setName(project?.name ?? '')
    setDescription(project?.description ?? '')
  }, [project?.id, project?.name, project?.description])

  if (!project) return null

  function commitName() {
    const n = name.trim()
    if (n && n !== project!.name) updateProject(project!.id, { name: n })
    else if (!n) setName(project!.name)
  }

  function commitDescription() {
    if (description !== (project!.description ?? '')) updateProject(project!.id, { description: description || undefined })
  }

  function handleDelete() {
    if (window.confirm(`Delete "${project!.name}"? This removes all its folders, phases, and cards.`)) {
      deleteProject(project!.id)
      onClose()
    }
  }

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={project.name} size="lg" hideVisualTitle>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        className="-mt-8 mb-5 w-full rounded-lg border border-transparent px-1.5 py-1 text-lg font-semibold text-slate-100 transition hover:border-white/10 focus:border-indigo-400/50 focus:outline-none"
      />

      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={commitDescription}
          rows={3}
          placeholder="What is this project about?"
          className="input resize-none"
        />
      </Field>

      <Field label="Resources" className="mt-5">
        <LinksEditor
          links={project.links}
          onAdd={(label, url) => addProjectLink(project.id, label, url)}
          onUpdate={(linkId, patch) => updateProjectLink(project.id, linkId, patch)}
          onRemove={(linkId) => removeProjectLink(project.id, linkId)}
        />
      </Field>

      <Field label="Attachments" className="mt-5">
        <AttachmentsEditor
          attachments={project.attachments}
          onAdd={(file) => addProjectAttachment(project.id, file)}
          onRemove={(attachmentId) => removeProjectAttachment(project.id, attachmentId)}
        />
      </Field>

      <div className="mt-7 border-t border-white/[0.06] pt-4">
        <button type="button" onClick={handleDelete} className="btn-danger-link">
          Delete project
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
