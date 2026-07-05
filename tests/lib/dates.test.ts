import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatDueDate, isDueToday, isOverdue } from '../../src/lib/dates'

describe('dates', () => {
  beforeEach(() => {
    // Fixed "now" so isOverdue/isDueToday are deterministic regardless of
    // when the suite actually runs.
    vi.setSystemTime(new Date('2026-07-04T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('formatDueDate', () => {
    it('formats an ISO date as "MMM d, yyyy"', () => {
      expect(formatDueDate('2026-07-04')).toBe('Jul 4, 2026')
    })

    it('formats a single-digit day without zero-padding', () => {
      expect(formatDueDate('2026-01-05')).toBe('Jan 5, 2026')
    })
  })

  describe('isOverdue', () => {
    it('is false for today', () => {
      expect(isOverdue('2026-07-04')).toBe(false)
    })

    it('is true for a date in the past', () => {
      expect(isOverdue('2026-07-01')).toBe(true)
    })

    it('is false for a date in the future', () => {
      expect(isOverdue('2026-07-10')).toBe(false)
    })
  })

  describe('isDueToday', () => {
    it('is true for today', () => {
      expect(isDueToday('2026-07-04')).toBe(true)
    })

    it('is false for any other day', () => {
      expect(isDueToday('2026-07-03')).toBe(false)
      expect(isDueToday('2026-07-05')).toBe(false)
    })
  })
})
