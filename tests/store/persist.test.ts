import { describe, expect, it, vi } from 'vitest'
import { boardStorage, requireFS } from '../../src/store/persist'
import { useSaveStatusStore } from '../../src/store/saveStatus'
import { createMockBoardFS } from '../setup'

describe('requireFS', () => {
  it('returns window.boardFS when present', () => {
    expect(requireFS()).toBe(window.boardFS)
  })

  it('throws a descriptive error when the Electron bridge is missing', () => {
    window.boardFS = undefined
    expect(() => requireFS()).toThrow(/npm run dev/)
  })
})

describe('boardStorage', () => {
  it('getItem returns null when the bridge reports no saved state', async () => {
    window.boardFS = createMockBoardFS()
    const storage = boardStorage()
    await expect(storage.getItem('ledger-store')).resolves.toBeNull()
  })

  it('getItem wraps the loaded state as { state, version: 0 }', async () => {
    const fakeState = { projects: {}, columns: {}, cards: {}, tags: {}, folders: {} }
    window.boardFS = createMockBoardFS()
    window.boardFS.loadState = vi.fn(async () => fakeState)
    const storage = boardStorage()
    await expect(storage.getItem('ledger-store')).resolves.toEqual({ state: fakeState, version: 0 })
  })

  it('setItem tracks saving -> saved status around a successful save', async () => {
    window.boardFS = createMockBoardFS()
    const storage = boardStorage()
    await storage.setItem('ledger-store', { state: {}, version: 0 })
    expect(window.boardFS.saveState).toHaveBeenCalledWith({})
    expect(useSaveStatusStore.getState().status).toBe('saved')
  })

  it('setItem tracks saving -> error and rethrows when the save fails', async () => {
    window.boardFS = createMockBoardFS()
    const failure = new Error('disk full')
    window.boardFS.saveState = vi.fn(async () => {
      throw failure
    })
    const storage = boardStorage()
    await expect(storage.setItem('ledger-store', { state: {}, version: 0 })).rejects.toThrow('disk full')
    expect(useSaveStatusStore.getState().status).toBe('error')
  })

  it('removeItem saves an empty board rather than deleting anything', async () => {
    window.boardFS = createMockBoardFS()
    const storage = boardStorage()
    await storage.removeItem('ledger-store')
    expect(window.boardFS.saveState).toHaveBeenCalledWith({ projects: {}, columns: {}, cards: {}, tags: {}, folders: {} })
  })
})
