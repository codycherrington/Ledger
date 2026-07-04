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
    headers: ['id', 'name', 'description', 'links', 'attachments', 'createdAt', 'updatedAt', 'columnOrder', 'columnId'],
    toRow: (p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      links: toJson(p.links),
      attachments: toJson(p.attachments),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      columnOrder: joinIds(p.columnOrder),
      columnId: p.columnId ?? '',
    }),
    fromRow: (r) => ({
      id: r.id,
      name: r.name,
      description: orUndefined(r.description),
      links: fromJson(r.links, []),
      attachments: fromJson(r.attachments, []),
      createdAt: Number(r.createdAt),
      updatedAt: Number(r.updatedAt),
      columnOrder: splitIds(r.columnOrder),
      // Legacy rows predate the Home board and have no columnId; backfilled
      // into Home's "To Do" column by ensureFixedPhases on next rehydrate.
      columnId: r.columnId ?? '',
    }),
  },
  columns: {
    file: 'columns.csv',
    headers: ['id', 'ownerType', 'ownerId', 'name', 'color', 'cardOrder'],
    toRow: (c) => ({
      id: c.id,
      ownerType: c.ownerType,
      ownerId: c.ownerId ?? '',
      name: c.name,
      color: c.color,
      cardOrder: joinIds(c.cardOrder),
    }),
    fromRow: (r) => ({
      id: r.id,
      // Legacy rows predate ownerType/ownerId and carry projectId instead —
      // every legacy column was always project-owned.
      ownerType: r.ownerType || 'project',
      ownerId: r.ownerType ? orUndefined(r.ownerId) : r.projectId,
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
      'folderId',
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
      projectId: c.projectId ?? '',
      folderId: c.folderId ?? '',
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
      projectId: orUndefined(r.projectId),
      folderId: orUndefined(r.folderId),
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
    // Tags are a single global pool now (not project-scoped) — no projectId.
    headers: ['id', 'name', 'color'],
    toRow: (t) => ({ id: t.id, name: t.name, color: t.color }),
    fromRow: (r) => ({ id: r.id, name: r.name, color: r.color }),
  },
  folders: {
    file: 'folders.csv',
    // Folders are a flat grouping of tasks now, not their own board — taskIds
    // replaces the old columnOrder (which listed the folder's own 4 columns).
    headers: ['id', 'ownerType', 'ownerId', 'name', 'color', 'description', 'columnId', 'taskIds', 'createdAt', 'updatedAt'],
    toRow: (f) => ({
      id: f.id,
      ownerType: f.ownerType,
      ownerId: f.ownerId ?? '',
      name: f.name,
      color: f.color,
      description: f.description ?? '',
      columnId: f.columnId,
      taskIds: joinIds(f.taskIds),
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }),
    fromRow: (r) => ({
      id: r.id,
      ownerType: r.ownerType,
      ownerId: orUndefined(r.ownerId),
      name: r.name,
      color: r.color,
      description: orUndefined(r.description),
      columnId: r.columnId,
      // Legacy rows predate the flat-list model and carried columnOrder
      // (their own 4 sub-columns) instead — those rows have no valid
      // taskIds and start out empty; nothing references the old columnOrder
      // ids anymore so they're simply dropped.
      taskIds: splitIds(r.taskIds),
      createdAt: Number(r.createdAt),
      updatedAt: Number(r.updatedAt),
    }),
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

// Folders used to own their own 4 columns (To Do/In Progress/Done/NULLSPACE),
// with filed tasks living in those columns' cardOrder, before folders became
// a flat grouping. Any folder still missing taskIds (i.e. loaded from a
// pre-migration folders.csv row) gets them reconstructed from those leftover
// columns, which are then discarded — nothing reads a folder-owned column
// anymore. Each filed card's columnId is remapped from its old folder
// sub-column onto the matching-by-name real column of the folder's owner
// board (home or project), since a card's columnId is now a meaningful
// "status" (shown as a pill) rather than a dead pointer to a deleted column.
function migrateLegacyFolderColumns(state) {
  const FIXED_NAMES = ['To Do', 'In Progress', 'Done', 'NULLSPACE']
  let changed = false
  for (const folder of Object.values(state.folders)) {
    if (folder.taskIds.length > 0) continue
    const ownColumns = Object.values(state.columns).filter((c) => c.ownerType === 'folder' && c.ownerId === folder.id)
    if (ownColumns.length === 0) continue
    const byName = new Map(ownColumns.map((c) => [c.name, c]))

    const ownerColumns = Object.values(state.columns).filter((c) =>
      folder.ownerType === 'home' ? c.ownerType === 'home' : c.ownerType === 'project' && c.ownerId === folder.ownerId,
    )
    const ownerByName = new Map(ownerColumns.map((c) => [c.name, c]))

    const taskIds = []
    for (const name of FIXED_NAMES) {
      const col = byName.get(name)
      if (!col) continue
      const targetColumn = ownerByName.get(name)
      for (const cardId of col.cardOrder) {
        taskIds.push(cardId)
        if (targetColumn && state.cards[cardId]) state.cards[cardId].columnId = targetColumn.id
      }
    }
    folder.taskIds = taskIds
    for (const col of ownColumns) delete state.columns[col.id]
    changed = true
  }
  return changed
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
  if (!anyFileFound) return null

  // Persist the migration immediately rather than waiting on the next
  // user-triggered save, so the on-disk files don't linger in the old schema.
  if (migrateLegacyFolderColumns(state)) saveState(state)

  return state
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
