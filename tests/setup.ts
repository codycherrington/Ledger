import { beforeEach, vi } from 'vitest'
import type { BoardFS } from '../src/store/persist'

// Ledger only runs inside Electron; `window.boardFS` is the bridge exposed
// by electron/preload.cjs (see src/store/persist.ts). jsdom (the test
// environment) has no such bridge, so every test gets a fresh in-memory
// stand-in by default. Tests that care about persistence behavior override
// individual methods with vi.spyOn/mockImplementation as needed.
export function createMockBoardFS(): BoardFS {
  return {
    loadState: vi.fn(async () => null),
    saveState: vi.fn(async () => {}),
    putAttachment: vi.fn(async () => {}),
    getAttachment: vi.fn(async () => null),
    deleteAttachment: vi.fn(async () => {}),
  }
}

beforeEach(() => {
  window.boardFS = createMockBoardFS()
})
