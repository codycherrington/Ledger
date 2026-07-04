import { BoardGlyph, ListIcon } from './icons'

interface ViewToggleProps {
  view: 'board' | 'table'
  onChange: (view: 'board' | 'table') => void
}

export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="no-drag flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
      <button
        type="button"
        aria-label="Board view"
        onClick={() => onChange('board')}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
          view === 'board' ? 'bg-white/[0.08] text-slate-100' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <BoardGlyph className="h-3.5 w-3.5" />
        Board
      </button>
      <button
        type="button"
        aria-label="Table view"
        onClick={() => onChange('table')}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
          view === 'table' ? 'bg-white/[0.08] text-slate-100' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <ListIcon className="h-3.5 w-3.5" />
        Table
      </button>
    </div>
  )
}
