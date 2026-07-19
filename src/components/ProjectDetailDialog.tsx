import { useEffect, useState, type ReactNode } from 'react'
import Modal from './Modal'
import LinksEditor from './LinksEditor'
import AttachmentsEditor from './AttachmentsEditor'
import CopyButton from './CopyButton'
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
  const pickRepoFolder = useBoardStore((s) => s.pickRepoFolder)
  const openClaudeCodeHere = useBoardStore((s) => s.openClaudeCodeHere)

  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')

  useEffect(() => {
    setName(project?.name ?? '')
    setDescription(project?.description ?? '')
    setMode('view')
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

  function handleSave() {
    commitName()
    commitDescription()
    setMode('view')
  }

  function handleDelete() {
    if (window.confirm(`Delete "${project!.name}"? This removes all its folders, phases, and cards.`)) {
      deleteProject(project!.id)
      onClose()
    }
  }

  const canStartClaude = project.claudeCodeEnabled && project.repoPath

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={project.name}
      size="lg"
      hideVisualTitle
      footer={
        <div className="flex items-center justify-between">
          {mode === 'view' ? (
            <button type="button" onClick={() => setMode('edit')} className="btn-ghost">
              Edit
            </button>
          ) : (
            <button type="button" onClick={handleSave} className="btn-primary">
              Save
            </button>
          )}
          <div className="flex items-center gap-2">
            {mode === 'view' && canStartClaude && (
              <button
                type="button"
                onClick={() => void openClaudeCodeHere(project.repoPath!)}
                className="rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/30"
              >
                Start with Claude Code
              </button>
            )}
            {mode === 'view' ? (
              <button type="button" onClick={onClose} className="btn-primary">
                Done
              </button>
            ) : (
              <button type="button" onClick={handleDelete} className="btn-danger">
                Delete
              </button>
            )}
          </div>
        </div>
      }
    >
      {mode === 'edit' ? (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          className="mb-5 w-full rounded-lg border border-transparent px-1.5 py-1 text-lg font-semibold text-slate-100 transition hover:border-white/10 focus:border-indigo-400/50 focus:outline-none"
        />
      ) : (
        <p className="mb-5 px-1.5 py-1 text-lg font-semibold text-slate-100">{project.name}</p>
      )}

      <Field label="Description" action={description.trim() && <CopyButton text={description} label="Copy description" />}>
        {mode === 'edit' ? (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={commitDescription}
            rows={8}
            placeholder="What is this project about?"
            className="input resize-none"
          />
        ) : project.description?.trim() ? (
          <p className="text-sm whitespace-pre-wrap text-slate-300">{project.description}</p>
        ) : (
          <p className="text-xs text-slate-600">No description added.</p>
        )}
      </Field>

      <Field label="Resources" className="mt-5">
        <LinksEditor
          links={project.links}
          onAdd={(label, url) => addProjectLink(project.id, label, url)}
          onUpdate={(linkId, patch) => updateProjectLink(project.id, linkId, patch)}
          onRemove={(linkId) => removeProjectLink(project.id, linkId)}
          readOnly={mode === 'view'}
        />
      </Field>

      <Field label="Attachments" className="mt-5">
        <AttachmentsEditor
          attachments={project.attachments}
          onAdd={(file) => addProjectAttachment(project.id, file)}
          onRemove={(attachmentId) => removeProjectAttachment(project.id, attachmentId)}
          readOnly={mode === 'view'}
        />
      </Field>

      <Field label="Claude Code" className="mt-5">
        {mode === 'edit' ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateProject(project.id, { claudeCodeEnabled: !project.claudeCodeEnabled })}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                project.claudeCodeEnabled
                  ? 'border-indigo-400/40 bg-indigo-500/20 text-indigo-300'
                  : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300'
              }`}
            >
              {project.claudeCodeEnabled ? 'Claude Code project' : 'Enable Claude Code'}
            </button>
            {project.claudeCodeEnabled && (
              <>
                <span className="truncate text-xs text-slate-500">{project.repoPath ?? 'No folder selected'}</span>
                <button
                  type="button"
                  onClick={async () => {
                    const folder = await pickRepoFolder()
                    if (folder) updateProject(project.id, { repoPath: folder, claudeCodeEnabled: true })
                  }}
                  className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-slate-400 transition hover:border-white/20 hover:text-slate-300"
                >
                  Choose Folder…
                </button>
              </>
            )}
          </div>
        ) : project.claudeCodeEnabled ? (
          <p className="truncate text-sm text-slate-300">{project.repoPath ?? 'No folder selected'}</p>
        ) : (
          <p className="text-xs text-slate-600">Not enabled</p>
        )}
      </Field>
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
