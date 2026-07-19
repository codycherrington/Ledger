import { create } from 'zustand'

// Ephemeral, UI-only, not persisted to disk — same rationale as
// viewMode.ts/saveStatus.ts. Unlike viewMode's single app-wide setting,
// this is keyed per board: collapsing Done on one board shouldn't affect
// any other board you navigate to, but it should be remembered for the
// life of the running app whenever you come back to that same board.
interface DoneCollapseState {
  collapsed: Record<string, boolean>
  toggle: (boardKey: string) => void
}

export const useDoneCollapseStore = create<DoneCollapseState>((set) => ({
  collapsed: {},
  toggle: (boardKey) =>
    set((state) => ({ collapsed: { ...state.collapsed, [boardKey]: !state.collapsed[boardKey] } })),
}))

export function ownerBoardKey(ownerType: 'home' | 'project', ownerId?: string): string {
  return ownerType === 'home' ? 'home' : `project:${ownerId}`
}

export function folderBoardKey(folderId: string): string {
  return `folder:${folderId}`
}
