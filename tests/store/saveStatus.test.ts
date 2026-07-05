import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSaveStatusStore } from '../../src/store/saveStatus'

beforeEach(() => {
  useSaveStatusStore.setState({ status: 'idle', savedAt: null })
})

describe('useSaveStatusStore', () => {
  it('starts idle with no savedAt', () => {
    const state = useSaveStatusStore.getState()
    expect(state.status).toBe('idle')
    expect(state.savedAt).toBeNull()
  })

  it('setSaving transitions to saving without touching savedAt', () => {
    useSaveStatusStore.getState().setSaving()
    const state = useSaveStatusStore.getState()
    expect(state.status).toBe('saving')
    expect(state.savedAt).toBeNull()
  })

  it('setSaved transitions to saved and stamps savedAt with the current time', () => {
    vi.setSystemTime(1751600000000)
    useSaveStatusStore.getState().setSaved()
    const state = useSaveStatusStore.getState()
    expect(state.status).toBe('saved')
    expect(state.savedAt).toBe(1751600000000)
    vi.useRealTimers()
  })

  it('setError transitions to error', () => {
    useSaveStatusStore.getState().setError()
    expect(useSaveStatusStore.getState().status).toBe('error')
  })
})
