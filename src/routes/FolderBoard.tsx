import { useNavigate, useParams } from 'react-router-dom'
import { useBoardStore } from '../store/board'
import FolderBoardShell from '../components/FolderBoardShell'

export default function FolderBoard() {
  const { folderId = '' } = useParams()
  const navigate = useNavigate()
  const folder = useBoardStore((s) => s.folders[folderId])

  if (!folder) {
    return (
      <div className="flex h-screen flex-col">
        <div className="app-drag h-11 shrink-0" />
        <div className="mx-auto max-w-lg px-6 py-24 text-center">
          <p className="text-slate-400">Folder not found.</p>
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
    <FolderBoardShell
      folder={folder}
      onBack={() => navigate(folder.ownerType === 'project' ? `/project/${folder.ownerId}` : '/')}
    />
  )
}
