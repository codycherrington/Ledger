import { useBoardStore } from '../store/board'
import { TerminalIcon } from './icons'

interface OpenClaudeCodeButtonProps {
  repoPath: string
}

// Just opens a Terminal window cd'd into the project's repo with `claude`
// running — no task prompt, no recap, unlike startClaudeCode's per-task
// launch flow. For jumping into a project's Claude Code session by hand.
export default function OpenClaudeCodeButton({ repoPath }: OpenClaudeCodeButtonProps) {
  const openClaudeCodeHere = useBoardStore((s) => s.openClaudeCodeHere)

  return (
    <button
      type="button"
      onClick={() => void openClaudeCodeHere(repoPath)}
      title="Open this project's folder in Claude Code"
      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-slate-400 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-slate-100"
    >
      <TerminalIcon />
      Open Claude Code
    </button>
  )
}
