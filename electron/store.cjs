'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { encodeCsv, parseCsv } = require('./csv.cjs')

// Hardcoded to this checkout: TaskTray is a local-only, unshipped app tied to
// this one machine and project folder, not a distributable package, so the
// data directory lives in the repo (`data/`) rather than under the installed
// app's own bundle path (which would point into /Applications, not here).
const DATA_DIR = path.join('/Users/codycherrington/Documents/Development/Projects/tasktray', 'data')
const ATTACHMENTS_DIR = path.join(DATA_DIR, 'attachments')

function ensureDirs() {
  fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true })
}

// Serialization helpers. List-of-id fields are joined with ";" (nanoid's
// alphabet never contains ";"). Nested structures (links, checklist,
// attachment metadata) are stored as JSON inside a CSV cell.
const joinIds = (ids) => (ids ?? []).join(';')
const splitIds = (str) => (str ? str.split(';') : [])
const toJson = (value) => JSON.stringify(value ?? [])
const fromJson = (str, fallback) => {
  if (!str) return fallback
  try {
    return JSON.parse(str)
  } catch {
    return fallback
  }
}
const orUndefined = (str) => (str === '' ? undefined : str)

const TABLES = {
  projects: {
    file: 'projects.csv',
    headers: ['id', 'name', 'description', 'createdAt', 'updatedAt', 'columnOrder'],
    toRow: (p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      columnOrder: joinIds(p.columnOrder),
    }),
    fromRow: (r) => ({
      id: r.id,
      name: r.name,
      description: orUndefined(r.description),
      createdAt: Number(r.createdAt),
      updatedAt: Number(r.updatedAt),
      columnOrder: splitIds(r.columnOrder),
    }),
  },
  columns: {
    file: 'columns.csv',
    headers: ['id', 'projectId', 'name', 'color', 'cardOrder'],
    toRow: (c) => ({
      id: c.id,
      projectId: c.projectId,
      name: c.name,
      color: c.color,
      cardOrder: joinIds(c.cardOrder),
    }),
    fromRow: (r) => ({
      id: r.id,
      projectId: r.projectId,
      name: r.name,
      color: r.color,
      cardOrder: splitIds(r.cardOrder),
    }),
  },
  cards: {
    file: 'cards.csv',
    headers: [
      'id',
      'projectId',
      'columnId',
      'title',
      'summary',
      'priority',
      'dueDate',
      'tagIds',
      'links',
      'attachments',
      'checklist',
      'createdAt',
      'updatedAt',
    ],
    toRow: (c) => ({
      id: c.id,
      projectId: c.projectId,
      columnId: c.columnId,
      title: c.title,
      summary: c.summary ?? '',
      priority: c.priority ?? '',
      dueDate: c.dueDate ?? '',
      tagIds: joinIds(c.tagIds),
      links: toJson(c.links),
      attachments: toJson(c.attachments),
      checklist: toJson(c.checklist),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }),
    fromRow: (r) => ({
      id: r.id,
      projectId: r.projectId,
      columnId: r.columnId,
      title: r.title,
      summary: orUndefined(r.summary),
      priority: orUndefined(r.priority),
      dueDate: orUndefined(r.dueDate),
      tagIds: splitIds(r.tagIds),
      links: fromJson(r.links, []),
      attachments: fromJson(r.attachments, []),
      checklist: fromJson(r.checklist, []),
      createdAt: Number(r.createdAt),
      updatedAt: Number(r.updatedAt),
    }),
  },
  tags: {
    file: 'tags.csv',
    headers: ['id', 'projectId', 'name', 'color'],
    toRow: (t) => ({ id: t.id, projectId: t.projectId, name: t.name, color: t.color }),
    fromRow: (r) => ({ id: r.id, projectId: r.projectId, name: r.name, color: r.color }),
  },
}

function writeFileAtomic(filePath, contents) {
  const tmp = filePath + '.tmp'
  fs.writeFileSync(tmp, contents, 'utf8')
  fs.renameSync(tmp, filePath)
}

function saveState(state) {
  ensureDirs()
  for (const [key, table] of Object.entries(TABLES)) {
    const records = Object.values(state[key] ?? {}).map(table.toRow)
    writeFileAtomic(path.join(DATA_DIR, table.file), encodeCsv(table.headers, records))
  }
}

function loadState() {
  const state = {}
  let anyFileFound = false
  for (const [key, table] of Object.entries(TABLES)) {
    const filePath = path.join(DATA_DIR, table.file)
    const byId = {}
    if (fs.existsSync(filePath)) {
      anyFileFound = true
      const rows = parseCsv(fs.readFileSync(filePath, 'utf8'))
      for (const row of rows) {
        if (!row.id) continue
        byId[row.id] = table.fromRow(row)
      }
    }
    state[key] = byId
  }
  return anyFileFound ? state : null
}

// Attachments are stored as plain files named "<id>__<original name>" so
// they stay identifiable both by the app and by a human browsing the folder.
function sanitizeName(name) {
  return name.replace(/[/\\:]/g, '_')
}

function attachmentPathById(id) {
  if (!fs.existsSync(ATTACHMENTS_DIR)) return null
  const prefix = `${id}__`
  const entry = fs.readdirSync(ATTACHMENTS_DIR).find((f) => f.startsWith(prefix))
  return entry ? path.join(ATTACHMENTS_DIR, entry) : null
}

function putAttachment(id, name, data) {
  ensureDirs()
  fs.writeFileSync(path.join(ATTACHMENTS_DIR, `${id}__${sanitizeName(name)}`), Buffer.from(data))
}

function getAttachment(id) {
  const filePath = attachmentPathById(id)
  if (!filePath) return null
  return {
    name: path.basename(filePath).slice(id.length + 2),
    data: fs.readFileSync(filePath),
  }
}

function deleteAttachment(id) {
  const filePath = attachmentPathById(id)
  if (filePath) fs.rmSync(filePath, { force: true })
}

module.exports = {
  DATA_DIR,
  ensureDirs,
  saveState,
  loadState,
  putAttachment,
  getAttachment,
  deleteAttachment,
}
