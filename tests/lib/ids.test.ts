import { describe, expect, it } from 'vitest'
import { makeId } from '../../src/lib/ids'

describe('makeId', () => {
  it('generates a non-empty string', () => {
    expect(makeId().length).toBeGreaterThan(0)
  })

  it('never contains a semicolon (relied on as the CSV list-field separator)', () => {
    // electron/store.cjs joins id lists with ";" on the assumption that
    // nanoid's alphabet never produces one — this guards that assumption.
    for (let i = 0; i < 200; i++) {
      expect(makeId()).not.toContain(';')
    }
  })

  it('generates unique ids across many calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => makeId()))
    expect(ids.size).toBe(1000)
  })
})
