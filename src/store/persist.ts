import type { PersistStorage } from 'zustand/middleware'
import { useSaveStatusStore } from './saveStatus'

// Bridge exposed by electron/preload.cjs. The app only runs inside Electron;
// there is no browser storage fallback. For UI development with hot reload,
// use `npm run dev` — it starts Vite and points an Electron window at it.
export interface BoardFS {
  loadState: () => Promise<unknown | null>
  saveState: (state: unknown) => Promise<void>
  putAttachment: (id: string, name: string, data: ArrayBuffer) => Promise<void>
  getAttachment: (id: string) => Promise<{ name: string; data: Uint8Array } | null>
  deleteAttachment: (id: string) => Promise<void>
  pickFolder: () => Promise<string | null>
  launchClaudeCode: (repoPath: string, prompt: string) => Promise<void>
  openClaudeCodeTerminal: (repoPath: string) => Promise<void>
}

declare global {
  interface Window {
    boardFS?: BoardFS
  }
}

export function requireFS(): BoardFS {
  if (!window.boardFS) {
    throw new Error(
      'Ledger stores data in CSV files through its Electron shell. Run "npm run dev" (or the installed app) instead of opening this page in a browser.',
    )
  }
  return window.boardFS
}

export function boardStorage<T>(): PersistStorage<T> {
  return {
    getItem: async () => {
      const state = await requireFS().loadState()
      return state ? { state: state as T, version: 0 } : null
    },
    setItem: async (_name, value) => {
      const { setSaving, setSaved, setError } = useSaveStatusStore.getState()
      setSaving()
      try {
        await requireFS().saveState(value.state)
        setSaved()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        throw err
      }
    },
    removeItem: async () => {
      await requireFS().saveState({ projects: {}, columns: {}, cards: {}, tags: {}, folders: {} })
    },
  }
}
