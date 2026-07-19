import { create } from 'zustand'

// Separate from the board store on purpose: persist.ts's boardStorage()
// wraps the *board* store's own persistence, so tracking save status inside
// that same store would mean the save-status update is itself a board
// mutation that triggers another save — this sidesteps that by living outside
// the persisted state entirely (never written to disk, UI-only).
interface SaveStatusState {
  status: 'idle' | 'saving' | 'saved' | 'error'
  savedAt: number | null
  error: string | null
  setSaving: () => void
  setSaved: () => void
  setError: (message: string) => void
}

export const useSaveStatusStore = create<SaveStatusState>((set) => ({
  status: 'idle',
  savedAt: null,
  error: null,
  setSaving: () => set({ status: 'saving', error: null }),
  setSaved: () => set({ status: 'saved', savedAt: Date.now(), error: null }),
  setError: (message) => set({ status: 'error', error: message }),
}))
