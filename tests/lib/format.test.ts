import { describe, expect, it } from 'vitest'
import { formatBytes } from '../../src/lib/format'

describe('formatBytes', () => {
  it('renders sub-1024 byte counts as whole bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1023)).toBe('1023 B')
  })

  it('renders kilobytes with one decimal place', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('renders megabytes once past the KB range', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB')
  })

  it('renders gigabytes and stops promoting units after GB', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB')
    // Far beyond a GB — should stay in GB rather than inventing a TB unit.
    expect(formatBytes(1024 * 1024 * 1024 * 2048)).toBe('2048.0 GB')
  })
})
