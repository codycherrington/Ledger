import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSaveStatusStore } from '../../src/store/saveStatus'

beforeEach(() => {
  useSaveStatusStore.setState({ status: 'idle', savedAt: null, error: null })
})

describe('useSaveStatusStore', () => {
  it('starts idle with no savedAt or error', () => {
    const state = useSaveStatusStore.getState()
    expect(state.status).toBe('idle')
    expect(state.savedAt).toBeNull()
    expect(state.error).toBeNull()
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

  it('setError transitions to error and stores the message', () => {
    useSaveStatusStore.getState().setError('ENOENT: no such file or directory')
    const state = useSaveStatusStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toBe('ENOENT: no such file or directory')
  })

  it('setSaving and setSaved clear a prior error', () => {
    useSaveStatusStore.getState().setError('boom')
    useSaveStatusStore.getState().setSaving()
    expect(useSaveStatusStore.getState().error).toBeNull()

    useSaveStatusStore.getState().setError('boom again')
    useSaveStatusStore.getState().setSaved()
    expect(useSaveStatusStore.getState().error).toBeNull()
  })
})
