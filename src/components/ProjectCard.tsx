import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDroppable } from '@dnd-kit/core'
import { useSortableItem } from '../lib/useSortableItem'
import ItemTypeBadge from './ItemTypeBadge'
import ProjectDetailDialog from './ProjectDetailDialog'
import { InfoIcon } from './icons'
import type { Project } from '../types'

interface ProjectCardProps {
  project: Project
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, style } = useSortableItem(project.id, { columnId: project.columnId })
  const [editing, setEditing] = useState(false)
  // Separate droppable (distinct id from the sortable one above) so a
  // standalone task can be dragged straight onto this card to attach it to
  // the project — same "outer wrapper vs. inner sortable" split FolderCard
  // uses to keep the two dnd-kit roles from colliding.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `project-drop:${project.id}`,
    data: { type: 'project', projectId: project.id },
  })

  return (
    <div ref={setDropRef}>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={() => navigate(`/project/${project.id}`)}
        className={`group cursor-grab rounded-xl border p-3.5 shadow-sm shadow-black/20 transition hover:border-white/[0.16] active:cursor-grabbing ${
          isOver ? 'border-indigo-400/60 bg-indigo-500/[0.08]' : 'border-white/[0.07] bg-raised'
        }`}
      >
        {/* float (not absolute) so wrapping name/description text flows
            around the icon instead of ever being able to sit underneath it */}
        <button
          type="button"
          aria-label="Project details"
          onClick={(e) => {
            e.stopPropagation()
            setEditing(true)
          }}
          className="icon-btn float-right mb-1 ml-2 opacity-0 transition group-hover:opacity-100"
        >
          <InfoIcon className="h-3.5 w-3.5" />
        </button>
        <ItemTypeBadge kind="project" />
        <p className="mt-0.5 text-sm font-medium text-slate-100">{project.name}</p>
        {project.description && <p className="mt-1.5 line-clamp-2 text-xs text-slate-400">{project.description}</p>}
      </div>

      {editing && <ProjectDetailDialog projectId={project.id} onClose={() => setEditing(false)} />}
    </div>
  )
}
