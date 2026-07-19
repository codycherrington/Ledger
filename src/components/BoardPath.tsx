import { useNavigate } from 'react-router-dom'

interface BoardPathProps {
  segments: { label: string; path: string }[]
  current: string
}

// Shown in the board/folder header ("menu bar") in place of a bare title —
// e.g. "Home / Quoridor Zero / Phase 1 — Engine + Tests" — so it's always
// clear where the board you're looking at sits in the project/folder tree.
export default function BoardPath({ segments, current }: BoardPathProps) {
  const navigate = useNavigate()

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {segments.map((seg) => (
        <span key={seg.path} className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate(seg.path)}
            className="no-drag truncate text-[15px] font-medium text-slate-500 transition hover:text-slate-300"
          >
            {seg.label}
          </button>
          <span className="text-slate-700">/</span>
        </span>
      ))}
      <h1 className="truncate text-[15px] font-semibold text-slate-100">{current}</h1>
    </div>
  )
}
