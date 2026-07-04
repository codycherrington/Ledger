import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={() => navigate(`/project/${project.id}`)}
        className="group cursor-grab rounded-xl border border-white/[0.07] bg-raised p-3.5 shadow-sm shadow-black/20 transition hover:border-white/[0.16] active:cursor-grabbing"
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
    </>
  )
}
