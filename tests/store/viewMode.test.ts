import { beforeEach, describe, expect, it } from 'vitest'
import { useViewModeStore } from '../../src/store/viewMode'

beforeEach(() => {
  useViewModeStore.setState({ view: 'board' })
})

describe('useViewModeStore', () => {
  it('defaults to board view', () => {
    expect(useViewModeStore.getState().view).toBe('board')
  })

  it('setView switches the shared view to table', () => {
    useViewModeStore.getState().setView('table')
    expect(useViewModeStore.getState().view).toBe('table')
  })

  it('setView switches back to board', () => {
    useViewModeStore.getState().setView('table')
    useViewModeStore.getState().setView('board')
    expect(useViewModeStore.getState().view).toBe('board')
  })

  it('is a single shared value, not keyed per board', () => {
    useViewModeStore.getState().setView('table')
    // Any consumer reading .view sees the same global value regardless of
    // which board/folder it's rendering for — there is no per-key state.
    const state = useViewModeStore.getState()
    expect(state.view).toBe('table')
    expect(Object.keys(state)).not.toContain('views')
  })
})
