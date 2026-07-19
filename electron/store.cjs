'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawn } = require('node:child_process')
const { encodeCsv, parseCsv } = require('./csv.cjs')

// Portable per-user location, same for the dev server and any built/installed
// copy of the app: ~/Library/Application Support/ledger (this app's only
// supported platform is macOS). Deliberately not derived from Electron's
// app.getPath('userData') — that resolves differently for `npm run dev`
// (app name "ledger", from package.json's `name`) vs. an electron-builder
// package (app name "Ledger", from `build.productName`), which would break
// the dev server and the installed app sharing one data folder. Computing it
// by hand with plain `os.homedir()` also means this module needs no Electron
// runtime, which is what lets it be required directly under plain Node in
// the test suite. LEDGER_DATA_DIR overrides this — set only by
// tests/electron/store.test.ts, to point at a disposable temp dir instead of
// a real location; never set when actually running the app.
const DEFAULT_DATA_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'ledger')
const DATA_DIR = process.env.LEDGER_DATA_DIR || DEFAULT_DATA_DIR
const ATTACHMENTS_DIR = path.join(DATA_DIR, 'attachments')

// Legacy locations to migrate from if DATA_DIR is empty, checked in priority
// order (most likely to hold real data first):
// 1. The portable location under this app's previous name, TaskTray — where
//    real data actually lives for any checkout that predates the rename to
//    Ledger. LEDGER_PREVIOUS_APP_DATA_DIR overrides this for testing only.
// 2. The original machine-specific hardcoded dev path from before DATA_DIR
//    became portable at all. LEDGER_LEGACY_DATA_DIR overrides this for
//    testing only; in real usage it's always this fixed path.
const PREVIOUS_APP_DATA_DIR =
  process.env.LEDGER_PREVIOUS_APP_DATA_DIR || path.join(os.homedir(), 'Library', 'Application Support', 'tasktray')
const LEGACY_DATA_DIR =
  process.env.LEDGER_LEGACY_DATA_DIR || '/Users/codycherrington/Documents/Development/Projects/tasktray/data'
const LEGACY_DATA_DIRS = [PREVIOUS_APP_DATA_DIR, LEGACY_DATA_DIR]

function ensureDirs() {
  fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true })
}

// Serialization helpers. List-of-id fields are joined with ";" (nanoid's
// alphabet never contains ";"). Nested structures (links, attachment
// metadata) are stored as JSON inside a CSV cell.
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
    headers: [
      'id',
      'name',
      'description',
      'links',
      'attachments',
      'createdAt',
      'updatedAt',
      'columnOrder',
      'columnId',
      'claudeCodeEnabled',
      'repoPath',
    ],
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
      claudeCodeEnabled: p.claudeCodeEnabled ? 'true' : '',
      repoPath: p.repoPath ?? '',
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
      // Legacy rows predate the Claude Code integration and have neither
      // column — both correctly fall back to disabled/unset.
      claudeCodeEnabled: r.claudeCodeEnabled === 'true',
      repoPath: orUndefined(r.repoPath),
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
    headers: [
      'id',
      'ownerType',
      'ownerId',
      'name',
      'color',
      'description',
      'priority',
      'dueDate',
      'tagIds',
      'links',
      'attachments',
      'columnId',
      'taskIds',
      'createdAt',
      'updatedAt',
    ],
    toRow: (f) => ({
      id: f.id,
      ownerType: f.ownerType,
      ownerId: f.ownerId ?? '',
      name: f.name,
      color: f.color,
      description: f.description ?? '',
      priority: f.priority ?? '',
      dueDate: f.dueDate ?? '',
      tagIds: joinIds(f.tagIds),
      links: toJson(f.links),
      attachments: toJson(f.attachments),
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
      // Legacy rows predate these fields and simply have no column for them —
      // orUndefined/splitIds/fromJson all treat the resulting '' as empty.
      priority: orUndefined(r.priority),
      dueDate: orUndefined(r.dueDate),
      tagIds: splitIds(r.tagIds),
      links: fromJson(r.links, []),
      attachments: fromJson(r.attachments, []),
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

function hasAnyDataFile(dir) {
  return Object.values(TABLES).some((table) => fs.existsSync(path.join(dir, table.file)))
}

// One-time migration for anyone whose data still sits at an old location: if
// the portable location has no data yet, check each legacy dir in priority
// order and copy (never move — the legacy folder is left in place as a
// backup) the CSVs and attachments from the first one that has data.
function migrateFromLegacyLocation() {
  if (hasAnyDataFile(DATA_DIR)) return
  for (const dir of LEGACY_DATA_DIRS) {
    if (!fs.existsSync(dir) || !hasAnyDataFile(dir)) continue
    fs.mkdirSync(DATA_DIR, { recursive: true })
    for (const entry of fs.readdirSync(dir)) {
      fs.cpSync(path.join(dir, entry), path.join(DATA_DIR, entry), { recursive: true })
    }
    return
  }
}

function loadState() {
  migrateFromLegacyLocation()

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

// Claude Code keys its own per-project session history off the cwd it
// was launched in, stored under ~/.claude/projects/<encoded-path>/*.jsonl
// (encoding: the absolute path with every "/" replaced by "-"). Checking for
// an existing session there is how launchClaudeCode decides whether to
// resume (--continue) or start fresh. LEDGER_CLAUDE_PROJECTS_DIR overrides
// this for tests only, so they never touch the real ~/.claude directory.
const CLAUDE_PROJECTS_DIR = process.env.LEDGER_CLAUDE_PROJECTS_DIR || path.join(os.homedir(), '.claude', 'projects')

function encodeClaudeProjectDir(repoPath) {
  return repoPath.replace(/\//g, '-')
}

function hasExistingSession(repoPath) {
  const dir = path.join(CLAUDE_PROJECTS_DIR, encodeClaudeProjectDir(repoPath))
  if (!fs.existsSync(dir)) return false
  return fs.readdirSync(dir).some((f) => f.endsWith('.jsonl'))
}

// Single-quotes a value for safe embedding in a POSIX shell command:
// wraps it in '...' and escapes any embedded single quote as '\''. Used for
// repoPath and the prompt file path below, both of which come from a native
// folder picker / this process's own tmp naming rather than user-typed text,
// but are quoted defensively regardless.
function shellQuoteSingle(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

// Launches Claude Code in a real Terminal.app window rather than spawning it
// directly from this (Electron) process: apps launched via Finder/
// LaunchServices don't inherit the user's shell PATH, so a direct spawn of
// "claude" would frequently fail with "command not found" even though it
// works fine when the user runs it by hand. Terminal.app sources the user's
// normal shell profile, so PATH resolution matches the command line exactly.
//
// The task prompt is never interpolated into the script's source text — it's
// written to its own temp file and read back via `"$(cat '<file>')"` at
// script run time. Double-quoting that command substitution suppresses word
// splitting and globbing, so arbitrary prompt content (quotes, backticks,
// "$", newlines) passes through inert instead of being re-parsed as shell
// syntax.
//
// LEDGER_DISABLE_CLAUDE_LAUNCH skips the actual `open -a Terminal` spawn —
// set only by the test file, so tests can inspect the generated script/prompt
// files without ever opening a real Terminal window or running the `claude`
// CLI. Never set when actually running the app.
function launchClaudeCode(repoPath, prompt) {
  const id = crypto.randomUUID()
  const promptFile = path.join(os.tmpdir(), `ledger-claude-prompt-${id}.txt`)
  const scriptFile = path.join(os.tmpdir(), `ledger-claude-launch-${id}.command`)

  fs.writeFileSync(promptFile, prompt ?? '')

  const resumeFlag = hasExistingSession(repoPath) ? '--continue ' : ''
  const script = [
    '#!/bin/zsh',
    `cd ${shellQuoteSingle(repoPath)}`,
    `claude ${resumeFlag}"$(cat ${shellQuoteSingle(promptFile)})"`,
    '',
  ].join('\n')
  fs.writeFileSync(scriptFile, script)
  fs.chmodSync(scriptFile, 0o755)

  if (process.env.LEDGER_DISABLE_CLAUDE_LAUNCH) return { scriptFile, promptFile }

  spawn('open', ['-a', 'Terminal', scriptFile], { detached: true, stdio: 'ignore' }).unref()
  return { scriptFile, promptFile }
}

module.exports = {
  DATA_DIR,
  ensureDirs,
  saveState,
  loadState,
  putAttachment,
  getAttachment,
  deleteAttachment,
  hasExistingSession,
  launchClaudeCode,
}
