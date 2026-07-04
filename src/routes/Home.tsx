import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { selectAllProjects, useBoardStore } from '../store/board'
import Modal from '../components/Modal'
import Menu from '../components/Menu'
import { BoardGlyph } from '../components/icons'
import type { Project } from '../types'

export default function Home() {
  const navigate = useNavigate()
  const projects = useBoardStore(useShallow(selectAllProjects))
  const createProject = useBoardStore((s) => s.createProject)
  const updateProject = useBoardStore((s) => s.updateProject)
  const deleteProject = useBoardStore((s) => s.deleteProject)

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)

  function handleDelete(project: Project) {
    if (window.confirm(`Delete "${project.name}"? This removes all its phases and cards.`)) {
      deleteProject(project.id)
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="app-drag h-11 shrink-0" />

      <main className="flex-1 overflow-y-auto px-10 pb-16">
        <div className="mx-auto w-full max-w-[1400px]">
          <header className="flex items-end justify-between pt-4 pb-10">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-slate-500 uppercase">
                TaskTray
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-100">
                Projects
              </h1>
            </div>
            <button type="button" onClick={() => setCreateOpen(true)} className="btn-primary no-drag">
              New project
            </button>
          </header>

          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-28 text-center">
              <BoardGlyph className="h-10 w-10 text-slate-600" />
              <p className="mt-4 text-sm text-slate-400">No projects yet.</p>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-4 text-sm font-medium text-indigo-400 hover:text-indigo-300"
              >
                Create your first project →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => navigate(`/project/${project.id}`)}
                  className="group cursor-pointer rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 transition hover:border-white/[0.14] hover:bg-white/[0.05]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-medium text-slate-100">{project.name}</h2>
                    <div className="opacity-0 transition group-hover:opacity-100">
                      <Menu
                        items={[
                          { label: 'Rename', onSelect: () => setEditing(project) },
                          { label: 'Delete', onSelect: () => handleDelete(project), danger: true },
                        ]}
                      />
                    </div>
                  </div>
                  {project.description && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-slate-400">{project.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <ProjectFormModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New Project"
        submitLabel="Create"
        onSubmit={(name, description) => {
          const id = createProject(name, description)
          setCreateOpen(false)
          navigate(`/project/${id}`)
        }}
      />

      <ProjectFormModal
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Rename Project"
        submitLabel="Save"
        initialName={editing?.name}
        initialDescription={editing?.description}
        onSubmit={(name, description) => {
          if (editing) updateProject(editing.id, { name, description })
          setEditing(null)
        }}
      />
    </div>
  )
}

interface ProjectFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  submitLabel: string
  initialName?: string
  initialDescription?: string
  onSubmit: (name: string, description?: string) => void
}

function ProjectFormModal({
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
