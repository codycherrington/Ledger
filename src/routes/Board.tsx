import { useNavigate, useParams } from 'react-router-dom'
import { useBoardStore } from '../store/board'
import BoardShell from '../components/BoardShell'

export default function Board() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const project = useBoardStore((s) => s.projects[projectId])

  if (!project) {
    return (
      <div className="flex h-screen flex-col">
        <div className="app-drag h-11 shrink-0" />
        <div className="mx-auto max-w-lg px-6 py-24 text-center">
          <p className="text-slate-400">Project not found.</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-3 text-sm font-medium text-indigo-400 hover:text-indigo-300"
          >
            ← Back to projects
          </button>
        </div>
      </div>
    )
  }

  return (
    <BoardShell
      ownerType="project"
      ownerId={projectId}
      title={project.name}
      onBack={() => navigate('/')}
      showTableToggle
    />
  )
}
