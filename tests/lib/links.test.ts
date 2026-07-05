import { describe, expect, it } from 'vitest'
import { safeHref } from '../../src/lib/links'

describe('safeHref', () => {
  it('accepts http URLs', () => {
    expect(safeHref('http://example.com')).toBe('http://example.com/')
  })

  it('accepts https URLs', () => {
    expect(safeHref('https://example.com/path?q=1')).toBe('https://example.com/path?q=1')
  })

  it('rejects javascript: URLs', () => {
    expect(safeHref('javascript:alert(1)')).toBeUndefined()
  })

  it('rejects data: URLs', () => {
    expect(safeHref('data:text/html,<script>alert(1)</script>')).toBeUndefined()
  })

  it('rejects file: URLs', () => {
    expect(safeHref('file:///etc/passwd')).toBeUndefined()
  })

  it('rejects malformed URLs', () => {
    expect(safeHref('not a url')).toBeUndefined()
    expect(safeHref('')).toBeUndefined()
  })
})
