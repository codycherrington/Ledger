import { describe, expect, it } from 'vitest'
// electron/csv.cjs is CommonJS; imported directly since Vite/Vitest
// transparently interops require()-style modules.
import { encodeCsv, parseCsv } from '../../electron/csv.cjs'

describe('encodeCsv', () => {
  it('writes a header row followed by one row per record', () => {
    const csv = encodeCsv(['id', 'name'], [{ id: '1', name: 'Alpha' }, { id: '2', name: 'Beta' }])
    expect(csv).toBe('id,name\r\n1,Alpha\r\n2,Beta\r\n')
  })

  it('quotes fields containing commas', () => {
    const csv = encodeCsv(['id', 'name'], [{ id: '1', name: 'Smith, Jane' }])
    expect(csv).toBe('id,name\r\n1,"Smith, Jane"\r\n')
  })

  it('quotes and escapes fields containing double quotes', () => {
    const csv = encodeCsv(['id', 'name'], [{ id: '1', name: 'She said "hi"' }])
    expect(csv).toBe('id,name\r\n1,"She said ""hi"""\r\n')
  })

  it('quotes fields containing embedded newlines', () => {
    const csv = encodeCsv(['id', 'notes'], [{ id: '1', notes: 'line one\nline two' }])
    expect(csv).toBe('id,notes\r\n1,"line one\nline two"\r\n')
  })

  it('renders null/undefined field values as empty strings', () => {
    const csv = encodeCsv(['id', 'description'], [{ id: '1', description: undefined }])
    expect(csv).toBe('id,description\r\n1,\r\n')
  })

  it('coerces numbers to strings without quoting', () => {
    const csv = encodeCsv(['id', 'createdAt'], [{ id: '1', createdAt: 1751600000000 }])
    expect(csv).toBe('id,createdAt\r\n1,1751600000000\r\n')
  })

  it('produces just the header row for an empty record list', () => {
    expect(encodeCsv(['id', 'name'], [])).toBe('id,name\r\n')
  })
})

describe('parseCsv', () => {
  it('parses a simple header + rows document into objects keyed by header', () => {
    const rows = parseCsv('id,name\r\n1,Alpha\r\n2,Beta\r\n')
    expect(rows).toEqual([
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
    ])
  })

  it('unescapes doubled quotes inside a quoted field', () => {
    const rows = parseCsv('id,name\r\n1,"She said ""hi"""\r\n')
    expect(rows[0].name).toBe('She said "hi"')
  })

  it('preserves commas inside a quoted field', () => {
    const rows = parseCsv('id,name\r\n1,"Smith, Jane"\r\n')
    expect(rows[0].name).toBe('Smith, Jane')
  })

  it('preserves embedded newlines inside a quoted field', () => {
    const rows = parseCsv('id,notes\r\n1,"line one\nline two"\r\n')
    expect(rows[0].notes).toBe('line one\nline two')
  })

  it('handles bare LF line endings, not just CRLF', () => {
    const rows = parseCsv('id,name\n1,Alpha\n2,Beta\n')
    expect(rows).toEqual([
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
    ])
  })

  it('handles bare CR-only line endings (old Mac style)', () => {
    const rows = parseCsv('id,name\r1,Alpha\r2,Beta\r')
    expect(rows).toEqual([
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
    ])
  })

  it('handles a trailing row with no final newline', () => {
    const rows = parseCsv('id,name\r\n1,Alpha')
    expect(rows).toEqual([{ id: '1', name: 'Alpha' }])
  })

  it('returns an empty array for empty input', () => {
    expect(parseCsv('')).toEqual([])
  })

  it('returns an empty array when only a header row is present', () => {
    expect(parseCsv('id,name\r\n')).toEqual([])
  })

  it('fills missing trailing cells with empty string when a row is short', () => {
    const rows = parseCsv('id,name,summary\r\n1,Alpha\r\n')
    expect(rows[0]).toEqual({ id: '1', name: 'Alpha', summary: '' })
  })

  it('round-trips a record with mixed special characters through encode/parse', () => {
    const original = [
      { id: '1', title: 'Comma, "quote", and\nnewline', tagIds: 'a;b;c' },
    ]
    const headers = ['id', 'title', 'tagIds']
    const roundTripped = parseCsv(encodeCsv(headers, original))
    expect(roundTripped).toEqual(original)
  })
})
