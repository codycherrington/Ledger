'use strict'

// Minimal RFC 4180 CSV encode/parse. Handles quoted fields containing
// commas, double quotes, and newlines.

function encodeField(value) {
  const str = value == null ? '' : String(value)
  if (/[",\r\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

function encodeCsv(headers, rows) {
  const lines = [headers.map(encodeField).join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => encodeField(row[h])).join(','))
  }
  return lines.join('\r\n') + '\r\n'
}

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let i = 0

  const endField = () => {
    row.push(field)
    field = ''
  }
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
  }

  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
        } else {
          inQuotes = false
          i += 1
        }
      } else {
        field += ch
        i += 1
      }
    } else if (ch === '"') {
      inQuotes = true
      i += 1
    } else if (ch === ',') {
      endField()
      i += 1
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i += 1
      endRow()
      i += 1
    } else if (ch === '\n') {
      endRow()
      i += 1
    } else {
      field += ch
      i += 1
    }
  }
  if (field !== '' || row.length > 0) endRow()

  if (rows.length === 0) return []
  const headers = rows[0]
  return rows.slice(1).map((cells) => {
    const obj = {}
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? ''
    })
    return obj
  })
}

module.exports = { encodeCsv, parseCsv }
