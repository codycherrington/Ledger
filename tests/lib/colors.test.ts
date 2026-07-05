import { describe, expect, it } from 'vitest'
import { COLOR_CLASSES, COLOR_NAMES, nextColor, PRIORITY_COLOR, STATUS_COLOR } from '../../src/lib/colors'

describe('nextColor', () => {
  it('cycles through COLOR_NAMES in order starting from 0', () => {
    for (let i = 0; i < COLOR_NAMES.length; i++) {
      expect(nextColor(i)).toBe(COLOR_NAMES[i])
    }
  })

  it('wraps around once usedCount exceeds the palette size', () => {
    expect(nextColor(COLOR_NAMES.length)).toBe(COLOR_NAMES[0])
    expect(nextColor(COLOR_NAMES.length + 1)).toBe(COLOR_NAMES[1])
  })

  it('handles a large usedCount without going out of range', () => {
    const color = nextColor(COLOR_NAMES.length * 5 + 3)
    expect(COLOR_NAMES).toContain(color)
  })
})

describe('COLOR_CLASSES', () => {
  it('has an entry for every color name', () => {
    for (const name of COLOR_NAMES) {
      expect(COLOR_CLASSES[name]).toBeDefined()
      expect(COLOR_CLASSES[name].dot).toContain(name)
    }
  })
})

describe('PRIORITY_COLOR', () => {
  it('maps every priority level to a valid color name', () => {
    for (const color of Object.values(PRIORITY_COLOR)) {
      expect(COLOR_NAMES).toContain(color)
    }
  })

  it('uses semantically distinct colors for high/med/low', () => {
    expect(PRIORITY_COLOR.high).toBe('red')
    expect(PRIORITY_COLOR.med).toBe('amber')
    expect(PRIORITY_COLOR.low).toBe('emerald')
  })
})

describe('STATUS_COLOR', () => {
  it('covers all four fixed board columns', () => {
    expect(Object.keys(STATUS_COLOR).sort()).toEqual(['Done', 'In Progress', 'NULLSPACE', 'To Do'].sort())
  })
})
