import { create } from 'zustand'

// Ephemeral, UI-only, not persisted to disk — same rationale as
// saveStatus.ts. A single app-wide board/table setting: whichever mode is
// selected applies to every board (Home, every project, every folder) you
// open, so the toggle behaves as one consistent global switch rather than
// resetting or diverging per board.
export type ViewMode = 'board' | 'table'

interface ViewModeState {
  view: ViewMode
  setView: (view: ViewMode) => void
}

export const useViewModeStore = create<ViewModeState>((set) => ({
  view: 'board',
  setView: (view) => set({ view }),
}))
