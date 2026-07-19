#!/usr/bin/env node
'use strict'

// A plain-Node CLI for reading and writing Ledger's board data directly —
// no Electron shell required. It requires ../electron/store.cjs for I/O
// (same CSV read/write path the app itself uses) and reimplements the
// relevant slice of src/store/board.ts's pure state logic (fixed columns,
// id generation, folder filing, deletion cascades) so a write here produces
// exactly the same shape of data the app would have written itself.
//
// IMPORTANT: the running app only reads these CSV files once, at startup —
// see src/store/persist.ts. It does not watch for external changes. Every
// mutation inside the app re-serializes and overwrites the *entire* CSV set
// from its own in-memory copy. So if Ledger is open while this CLI writes,
// the next edit made in the app will silently clobber what this CLI just
// wrote. Always prefer running this while Ledger is quit, or tell the user
// to quit and reopen Ledger afterward before making any further edits there.

const { execSync } = require('node:child_process')
const store = require('../electron/store.cjs')

const FIXED_COLUMNS = [
  { name: 'To Do', color: 'slate' },
  { name: 'In Progress', color: 'sky' },
  { name: 'Done', color: 'emerald' },
  { name: 'Stash', color: 'violet' },
]

const COLOR_NAMES = [
  'slate', 'red', 'orange', 'amber', 'lime', 'emerald', 'teal', 'sky', 'blue', 'indigo', 'violet', 'fuchsia', 'pink',
]

class CliError extends Error {}

let makeId // assigned in main() after dynamically importing nanoid (ESM-only)

function nextColor(usedCount) {
  return COLOR_NAMES[usedCount % COLOR_NAMES.length]
}

function str(v) {
  return typeof v === 'string' ? v : undefined
}

function boolArg(v) {
  return v === true || v === 'true'
}

function emptyState() {
  return { projects: {}, columns: {}, cards: {}, tags: {}, folders: {} }
}

function loadOrInitState() {
  return store.loadState() || emptyState()
}

// ---- fixed-column bootstrap (mirrors ensureFixedPhases in src/store/board.ts) ----

function backfillOwnerColumns(columns, ownerType, ownerId, existingOrder) {
  const namesPresent = new Set(
    existingOrder.map((id) => columns[id]).filter(Boolean).map((c) => c.name),
  )
  let order = existingOrder
  let changed = false
  for (const def of FIXED_COLUMNS) {
    if (!namesPresent.has(def.name)) {
      const colId = makeId()
      columns[colId] = { id: colId, ownerType, ownerId, name: def.name, color: def.color, cardOrder: [] }
      order = [...order, colId]
      changed = true
    }
  }
  return changed ? order : null
}

function renameLegacyNullspaceColumns(columns) {
  let changed = false
  for (const col of Object.values(columns)) {
    if (col.name === 'NULLSPACE') {
      col.name = 'Stash'
      changed = true
    }
  }
  return changed
}

function ensureFixedPhases(state) {
  let changed = false
  if (renameLegacyNullspaceColumns(state.columns)) changed = true

  const homeExistingOrder = Object.values(state.columns).filter((c) => c.ownerType === 'home').map((c) => c.id)
  if (backfillOwnerColumns(state.columns, 'home', undefined, homeExistingOrder)) changed = true

  for (const [projectId, project] of Object.entries(state.projects)) {
    const order = backfillOwnerColumns(state.columns, 'project', projectId, project.columnOrder)
    if (order) {
      project.columnOrder = order
      changed = true
    }
  }

  const homeColumns = getOwnerColumns(state, 'home')
  const todoColumn = homeColumns.find((c) => c.name === 'To Do')
  if (todoColumn) {
    for (const [projectId, project] of Object.entries(state.projects)) {
      if (project.columnId && state.columns[project.columnId]) continue
      project.columnId = todoColumn.id
      todoColumn.cardOrder.push(projectId)
      changed = true
    }
  }

  return changed
}

function getOwnerColumns(state, ownerType, ownerId) {
  if (ownerType === 'home') {
    const byName = new Map(Object.values(state.columns).filter((c) => c.ownerType === 'home').map((c) => [c.name, c]))
    return FIXED_COLUMNS.map((def) => byName.get(def.name)).filter(Boolean)
  }
  const project = state.projects[ownerId]
  if (!project) return []
  const byName = new Map(project.columnOrder.map((id) => state.columns[id]).filter(Boolean).map((c) => [c.name, c]))
  return FIXED_COLUMNS.map((def) => byName.get(def.name)).filter(Boolean)
}

function findColumnByStatus(state, ownerType, ownerId, statusName) {
  const target = statusName.trim().toLowerCase()
  return getOwnerColumns(state, ownerType, ownerId).find((c) => c.name.toLowerCase() === target) || null
}

function resolveOwner(state, args) {
  if (boolArg(args.home)) return { ownerType: 'home', ownerId: undefined }
  const projectId = str(args.project)
  if (projectId) {
    if (!state.projects[projectId]) throw new CliError(`No project found with id "${projectId}"`)
    return { ownerType: 'project', ownerId: projectId }
  }
  throw new CliError('Specify --home or --project <id>')
}

function normalizePriority(value) {
  if (value === undefined || value === '') return undefined
  const map = { low: 'low', l: 'low', med: 'med', medium: 'med', m: 'med', high: 'high', h: 'high' }
  const p = map[value.trim().toLowerCase()]
  if (!p) throw new CliError(`Invalid priority "${value}" — use low, med, or high`)
  return p
}

function resolveTagIds(state, tagsArg) {
  const raw = str(tagsArg)
  if (!raw) return []
  const names = raw.split(',').map((s) => s.trim()).filter(Boolean)
  const ids = []
  for (const name of names) {
    let tag = Object.values(state.tags).find((t) => t.name.toLowerCase() === name.toLowerCase())
    if (!tag) {
      const id = makeId()
      tag = { id, name, color: nextColor(Object.keys(state.tags).length) }
      state.tags[id] = tag
    }
    ids.push(tag.id)
  }
  return ids
}

// ---- setCardStatus (mirrors src/store/board.ts) ----

function setCardStatus(state, card, columnId) {
  if (card.folderId) {
    card.columnId = columnId
    return
  }
  const fromColumn = state.columns[card.columnId]
  if (fromColumn) fromColumn.cardOrder = fromColumn.cardOrder.filter((cid) => cid !== card.id)
  state.columns[columnId].cardOrder.push(card.id)
  card.columnId = columnId
}

// Moves a board-item's own placement (project or folder card) between two
// columns' cardOrder — distinct from setCardStatus, which is for a *filed*
// task's display-only status pill.
function moveOwnPlacement(state, item, columnId) {
  const fromColumn = state.columns[item.columnId]
  if (fromColumn) fromColumn.cardOrder = fromColumn.cardOrder.filter((cid) => cid !== item.id)
  state.columns[columnId].cardOrder.push(item.id)
  item.columnId = columnId
}

// ---- serializers ----

function tagNames(state, tagIds) {
  return tagIds.map((id) => state.tags[id]?.name).filter(Boolean)
}

function ownerLabel(state, ownerType, ownerId) {
  return ownerType === 'home' ? 'Home' : (state.projects[ownerId]?.name ?? '(unknown project)')
}

function columnName(state, columnId) {
  return state.columns[columnId]?.name ?? null
}

function serializeProject(state, project) {
  return {
    id: project.id,
    kind: 'project',
    name: project.name,
    description: project.description ?? null,
    status: columnName(state, project.columnId),
    claudeCodeEnabled: !!project.claudeCodeEnabled,
    repoPath: project.repoPath ?? null,
    links: project.links,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
}

function serializeFolder(state, folder) {
  return {
    id: folder.id,
    kind: 'folder',
    name: folder.name,
    owner: ownerLabel(state, folder.ownerType, folder.ownerId),
    ownerType: folder.ownerType,
    ownerId: folder.ownerId ?? null,
    status: columnName(state, folder.columnId),
    description: folder.description ?? null,
    priority: folder.priority ?? null,
    dueDate: folder.dueDate ?? null,
    tags: tagNames(state, folder.tagIds),
    color: folder.color,
    taskCount: folder.taskIds.length,
    taskIds: folder.taskIds,
    links: folder.links,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  }
}

function serializeTask(state, card) {
  const ownerType = card.projectId ? 'project' : 'home'
  return {
    id: card.id,
    kind: 'task',
    title: card.title,
    owner: ownerLabel(state, ownerType, card.projectId),
    projectId: card.projectId ?? null,
    folder: card.folderId ? (state.folders[card.folderId]?.name ?? null) : null,
    folderId: card.folderId ?? null,
    status: columnName(state, card.columnId),
    summary: card.summary ?? null,
    priority: card.priority ?? null,
    dueDate: card.dueDate ?? null,
    tags: tagNames(state, card.tagIds),
    links: card.links,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  }
}

// ---- read commands ----

function cmdListProjects(state) {
  return Object.values(state.projects)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => serializeProject(state, p))
}

function cmdListFolders(state, args) {
  let folders = Object.values(state.folders)
  if (boolArg(args.home)) folders = folders.filter((f) => f.ownerType === 'home')
  else if (str(args.project)) folders = folders.filter((f) => f.ownerType === 'project' && f.ownerId === str(args.project))
  return folders.map((f) => serializeFolder(state, f))
}

function cmdListTasks(state, args) {
  let tasks = Object.values(state.cards)
  if (boolArg(args.home)) tasks = tasks.filter((c) => !c.projectId)
  else if (str(args.project)) tasks = tasks.filter((c) => c.projectId === str(args.project))
  if (str(args.folder)) tasks = tasks.filter((c) => c.folderId === str(args.folder))
  if (boolArg(args.unfiled)) tasks = tasks.filter((c) => !c.folderId)
  if (str(args.status)) {
    const target = args.status.trim().toLowerCase()
    tasks = tasks.filter((c) => (state.columns[c.columnId]?.name ?? '').toLowerCase() === target)
  }
  return tasks.map((c) => serializeTask(state, c))
}

function cmdShow(state, id) {
  if (state.projects[id]) return serializeProject(state, state.projects[id])
  if (state.folders[id]) return serializeFolder(state, state.folders[id])
  if (state.cards[id]) return serializeTask(state, state.cards[id])
  throw new CliError(`No project, folder, or task found with id "${id}"`)
}

// ---- write commands ----

function cmdCreateProject(state, args) {
  const name = str(args.name)
  if (!name) throw new CliError('Missing required --name')
  const id = makeId()
  const now = Date.now()
  const columnOrder = []
  for (const def of FIXED_COLUMNS) {
    const colId = makeId()
    state.columns[colId] = { id: colId, ownerType: 'project', ownerId: id, name: def.name, color: def.color, cardOrder: [] }
    columnOrder.push(colId)
  }
  const homeColumn = findColumnByStatus(state, 'home', undefined, str(args.status) || 'To Do')
  if (!homeColumn) throw new CliError('Could not resolve a Home column to place the project in')

  const project = {
    id,
    name,
    description: str(args.description),
    links: [],
    attachments: [],
    createdAt: now,
    updatedAt: now,
    columnOrder,
    columnId: homeColumn.id,
  }
  const repoPath = str(args['repo-path'])
  if (repoPath) {
    project.repoPath = repoPath
    project.claudeCodeEnabled = true
  } else if (boolArg(args['claude-code'])) {
    project.claudeCodeEnabled = true
  }

  state.projects[id] = project
  homeColumn.cardOrder.push(id)
  return serializeProject(state, project)
}

function cmdCreateFolder(state, args) {
  const name = str(args.name)
  if (!name) throw new CliError('Missing required --name')
  const owner = resolveOwner(state, args)
  const statusName = str(args.status) || 'To Do'
  const column = findColumnByStatus(state, owner.ownerType, owner.ownerId, statusName)
  if (!column) throw new CliError(`Could not find a "${statusName}" column for that owner`)

  const id = makeId()
  const now = Date.now()
  const folder = {
    id,
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    name,
    color: nextColor(Object.keys(state.folders).length),
    description: str(args.description),
    priority: normalizePriority(str(args.priority)),
    dueDate: str(args['due-date']),
    tagIds: resolveTagIds(state, args.tags),
    links: [],
    attachments: [],
    columnId: column.id,
    taskIds: [],
    createdAt: now,
    updatedAt: now,
  }
  state.folders[id] = folder
  column.cardOrder.push(id)
  return serializeFolder(state, folder)
}

function cmdCreateTask(state, args) {
  const title = str(args.title)
  if (!title) throw new CliError('Missing required --title')

  const id = makeId()
  const now = Date.now()
  let projectId, columnId, folderId

  const folderArg = str(args.folder)
  if (folderArg) {
    const folder = state.folders[folderArg]
    if (!folder) throw new CliError(`No folder found with id "${folderArg}"`)
    projectId = folder.ownerType === 'project' ? folder.ownerId : undefined
    folderId = folder.id
    columnId = folder.columnId
    const statusName = str(args.status)
    if (statusName) {
      const col = findColumnByStatus(state, folder.ownerType, folder.ownerId, statusName)
      if (!col) throw new CliError(`Could not find a "${statusName}" column for that folder's board`)
      columnId = col.id
    }
  } else {
    const owner = resolveOwner(state, args)
    const statusName = str(args.status) || 'To Do'
    const col = findColumnByStatus(state, owner.ownerType, owner.ownerId, statusName)
    if (!col) throw new CliError(`Could not find a "${statusName}" column for that owner`)
    projectId = owner.ownerType === 'project' ? owner.ownerId : undefined
    columnId = col.id
  }

  const card = {
    id,
    projectId,
    folderId,
    columnId,
    title,
    summary: str(args.summary),
    priority: normalizePriority(str(args.priority)),
    dueDate: str(args['due-date']),
    tagIds: resolveTagIds(state, args.tags),
    links: [],
    attachments: [],
    createdAt: now,
    updatedAt: now,
  }
  state.cards[id] = card
  if (folderId) state.folders[folderId].taskIds.push(id)
  else state.columns[columnId].cardOrder.push(id)
  return serializeTask(state, card)
}

function cmdUpdateTask(state, id, args) {
  const card = state.cards[id]
  if (!card) throw new CliError(`No task found with id "${id}"`)

  if (str(args.title)) card.title = args.title
  if (str(args.summary) !== undefined) card.summary = str(args.summary)
  if (boolArg(args['clear-summary'])) card.summary = undefined
  if (str(args.priority) !== undefined) card.priority = normalizePriority(str(args.priority))
  if (boolArg(args['clear-priority'])) card.priority = undefined
  if (str(args['due-date']) !== undefined) card.dueDate = str(args['due-date'])
  if (boolArg(args['clear-due-date'])) card.dueDate = undefined

  const statusName = str(args.status)
  if (statusName) {
    const ownerType = card.projectId ? 'project' : 'home'
    const col = findColumnByStatus(state, ownerType, card.projectId, statusName)
    if (!col) throw new CliError(`Could not find a "${statusName}" column for this task's board`)
    setCardStatus(state, card, col.id)
  }

  card.updatedAt = Date.now()
  return serializeTask(state, card)
}

function cmdUpdateFolder(state, id, args) {
  const folder = state.folders[id]
  if (!folder) throw new CliError(`No folder found with id "${id}"`)

  if (str(args.name)) folder.name = args.name
  if (str(args.description) !== undefined) folder.description = str(args.description)
  if (str(args.color)) folder.color = args.color
  if (str(args.priority) !== undefined) folder.priority = normalizePriority(str(args.priority))
  if (boolArg(args['clear-priority'])) folder.priority = undefined
  if (str(args['due-date']) !== undefined) folder.dueDate = str(args['due-date'])
  if (boolArg(args['clear-due-date'])) folder.dueDate = undefined

  const statusName = str(args.status)
  if (statusName) {
    const col = findColumnByStatus(state, folder.ownerType, folder.ownerId, statusName)
    if (!col) throw new CliError(`Could not find a "${statusName}" column for this folder's board`)
    moveOwnPlacement(state, folder, col.id)
  }

  folder.updatedAt = Date.now()
  return serializeFolder(state, folder)
}

function cmdUpdateProject(state, id, args) {
  const project = state.projects[id]
  if (!project) throw new CliError(`No project found with id "${id}"`)

  if (str(args.name)) project.name = args.name
  if (str(args.description) !== undefined) project.description = str(args.description)
  if (args['claude-code'] !== undefined) project.claudeCodeEnabled = boolArg(args['claude-code'])
  if (str(args['repo-path']) !== undefined) {
    project.repoPath = str(args['repo-path'])
    if (project.repoPath) project.claudeCodeEnabled = true
  }

  const statusName = str(args.status)
  if (statusName) {
    const col = findColumnByStatus(state, 'home', undefined, statusName)
    if (!col) throw new CliError(`Could not find a "${statusName}" Home column`)
    moveOwnPlacement(state, project, col.id)
  }

  project.updatedAt = Date.now()
  return serializeProject(state, project)
}

function cmdFileTask(state, taskId, args) {
  const folderId = str(args.folder)
  if (!folderId) throw new CliError('Missing required --folder')
  const card = state.cards[taskId]
  if (!card) throw new CliError(`No task found with id "${taskId}"`)
  const folder = state.folders[folderId]
  if (!folder) throw new CliError(`No folder found with id "${folderId}"`)

  const currentColumn = state.columns[card.columnId]
  if (currentColumn) currentColumn.cardOrder = currentColumn.cardOrder.filter((cid) => cid !== taskId)

  if (card.folderId && card.folderId !== folderId) {
    const prev = state.folders[card.folderId]
    if (prev) prev.taskIds = prev.taskIds.filter((tid) => tid !== taskId)
  }

  folder.taskIds = folder.taskIds.filter((tid) => tid !== taskId)
  folder.taskIds.push(taskId)
  card.folderId = folderId
  card.updatedAt = Date.now()
  return serializeTask(state, card)
}

function cmdUnfileTask(state, taskId, args) {
  const card = state.cards[taskId]
  if (!card) throw new CliError(`No task found with id "${taskId}"`)
  if (!card.folderId) throw new CliError('Task is not filed in a folder')

  const ownerType = card.projectId ? 'project' : 'home'
  const statusName = str(args.status) || columnName(state, card.columnId) || 'To Do'
  const col = findColumnByStatus(state, ownerType, card.projectId, statusName)
  if (!col) throw new CliError(`Could not find a "${statusName}" column for this task's board`)

  const folder = state.folders[card.folderId]
  if (folder) folder.taskIds = folder.taskIds.filter((tid) => tid !== taskId)

  col.cardOrder = col.cardOrder.filter((cid) => cid !== taskId)
  col.cardOrder.push(taskId)
  card.folderId = undefined
  card.columnId = col.id
  card.updatedAt = Date.now()
  return serializeTask(state, card)
}

function cmdAddTag(state, id, args) {
  const tagArg = str(args.tag)
  if (!tagArg) throw new CliError('Missing required --tag')
  const [tagId] = resolveTagIds(state, tagArg)
  if (state.cards[id]) {
    const card = state.cards[id]
    if (!card.tagIds.includes(tagId)) card.tagIds.push(tagId)
    card.updatedAt = Date.now()
    return serializeTask(state, card)
  }
  if (state.folders[id]) {
    const folder = state.folders[id]
    if (!folder.tagIds.includes(tagId)) folder.tagIds.push(tagId)
    folder.updatedAt = Date.now()
    return serializeFolder(state, folder)
  }
  throw new CliError(`No task or folder found with id "${id}"`)
}

function cmdRemoveTag(state, id, args) {
  const tagArg = str(args.tag)
  if (!tagArg) throw new CliError('Missing required --tag')
  const target = tagArg.trim().toLowerCase()
  if (state.cards[id]) {
    const card = state.cards[id]
    card.tagIds = card.tagIds.filter((tid) => (state.tags[tid]?.name ?? '').toLowerCase() !== target)
    card.updatedAt = Date.now()
    return serializeTask(state, card)
  }
  if (state.folders[id]) {
    const folder = state.folders[id]
    folder.tagIds = folder.tagIds.filter((tid) => (state.tags[tid]?.name ?? '').toLowerCase() !== target)
    folder.updatedAt = Date.now()
    return serializeFolder(state, folder)
  }
  throw new CliError(`No task or folder found with id "${id}"`)
}

function cmdAddLink(state, id, args) {
  const label = str(args.label)
  const url = str(args.url)
  if (!label) throw new CliError('Missing required --label')
  if (!url) throw new CliError('Missing required --url')
  const link = { id: makeId(), label, url }

  if (state.cards[id]) {
    state.cards[id].links.push(link)
    state.cards[id].updatedAt = Date.now()
    return serializeTask(state, state.cards[id])
  }
  if (state.folders[id]) {
    state.folders[id].links.push(link)
    state.folders[id].updatedAt = Date.now()
    return serializeFolder(state, state.folders[id])
  }
  if (state.projects[id]) {
    state.projects[id].links.push(link)
    state.projects[id].updatedAt = Date.now()
    return serializeProject(state, state.projects[id])
  }
  throw new CliError(`No project, folder, or task found with id "${id}"`)
}

function cmdDeleteTask(state, id) {
  const card = state.cards[id]
  if (!card) throw new CliError(`No task found with id "${id}"`)
  const column = state.columns[card.columnId]
  if (column) column.cardOrder = column.cardOrder.filter((cid) => cid !== id)
  delete state.cards[id]
  return { id, deleted: 'task' }
}

function cmdDeleteFolder(state, id) {
  const folder = state.folders[id]
  if (!folder) throw new CliError(`No folder found with id "${id}"`)
  const ownerColumn = state.columns[folder.columnId]
  if (ownerColumn) {
    ownerColumn.cardOrder = ownerColumn.cardOrder.filter((cid) => cid !== id).concat(folder.taskIds)
  }
  for (const taskId of folder.taskIds) {
    const card = state.cards[taskId]
    if (card) {
      card.folderId = undefined
      card.columnId = folder.columnId
      card.updatedAt = Date.now()
    }
  }
  delete state.folders[id]
  return { id, deleted: 'folder', unfiledTasks: folder.taskIds.length }
}

function cmdDeleteProject(state, id) {
  const project = state.projects[id]
  if (!project) throw new CliError(`No project found with id "${id}"`)

  const columnIds = Object.values(state.columns)
    .filter((c) => c.ownerType === 'project' && c.ownerId === id)
    .map((c) => c.id)
  const columnIdSet = new Set(columnIds)
  const folderIds = Object.values(state.folders).filter((f) => columnIdSet.has(f.columnId)).map((f) => f.id)
  const folderCardIds = folderIds.flatMap((fid) => state.folders[fid]?.taskIds ?? [])
  const directCardIds = Object.values(state.cards)
    .filter((c) => columnIdSet.has(c.columnId) && !c.folderId)
    .map((c) => c.id)
  const cardIds = [...directCardIds, ...folderCardIds]

  for (const cid of columnIds) delete state.columns[cid]
  const homeColumn = state.columns[project.columnId]
  if (homeColumn) homeColumn.cardOrder = homeColumn.cardOrder.filter((cid) => cid !== id)
  for (const cardId of cardIds) delete state.cards[cardId]
  for (const fid of folderIds) delete state.folders[fid]
  delete state.projects[id]

  return { id, deleted: 'project', removedTasks: cardIds.length, removedFolders: folderIds.length }
}

// ---- CLI plumbing ----

function parseArgs(argv) {
  const result = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]
    if (tok.startsWith('--')) {
      const key = tok.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        result[key] = next
        i++
      } else {
        result[key] = true
      }
    } else {
      result._.push(tok)
    }
  }
  return result
}

function requirePositional(args, index, label) {
  const value = args._[index]
  if (!value) throw new CliError(`Missing required positional argument: ${label}`)
  return value
}

function isLedgerRunning() {
  try {
    const out = execSync('ps ax -o command=', { encoding: 'utf8' })
    return out
      .split('\n')
      .some((line) => line.includes('Ledger.app/Contents/MacOS/Ledger') || line.includes('scripts/dev.mjs'))
  } catch {
    return false
  }
}

const READ_COMMANDS = new Set(['list-projects', 'list-folders', 'list-tasks', 'show'])

const HELP = `Ledger CLI — read and write board data directly (no Electron shell needed).

Read:
  list-projects
  list-folders    [--home | --project <id>]
  list-tasks      [--home | --project <id>] [--folder <id>] [--unfiled] [--status <name>]
  show <id>

Create:
  create-project  --name <name> [--description <text>] [--status <name>] [--repo-path <path>] [--claude-code]
  create-folder   (--home | --project <id>) --name <name> [--status <name>] [--description <text>]
                  [--priority low|med|high] [--due-date yyyy-mm-dd] [--tags a,b,c]
  create-task     (--home | --project <id>) --title <title> [--folder <id>] [--status <name>] [--summary <text>]
                  [--priority low|med|high] [--due-date yyyy-mm-dd] [--tags a,b,c]

Update:
  update-task     <id> [--title] [--summary] [--clear-summary] [--priority] [--clear-priority]
                  [--due-date] [--clear-due-date] [--status <name>]
  update-folder   <id> [--name] [--description] [--color] [--priority] [--clear-priority]
                  [--due-date] [--clear-due-date] [--status <name>]
  update-project  <id> [--name] [--description] [--status <name>] [--repo-path] [--claude-code true|false]

Filing:
  file-task       <id> --folder <folderId>
  unfile-task     <id> [--status <name>]   (defaults to the task's current status)

Tags & links:
  add-tag         <taskId|folderId> --tag <name>       (creates the tag if it doesn't exist)
  remove-tag      <taskId|folderId> --tag <name>
  add-link        <projectId|folderId|taskId> --label <label> --url <url>

Delete:
  delete-task     <id>
  delete-folder   <id>   (unfiles its tasks back to the board instead of deleting them)
  delete-project  <id>   (deletes its columns, folders, and every task inside them — confirm with the user first)

Status names are: To Do, In Progress, Done, Stash (case-insensitive).
All output is JSON on stdout. Errors set exit code 1 and print { "ok": false, "error": "..." }.
`

function printHelp() {
  console.log(HELP)
}

async function main() {
  const { nanoid } = await import('nanoid')
  makeId = nanoid

  const [, , command, ...rest] = process.argv
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    printHelp()
    return
  }

  const args = parseArgs(rest)
  const state = loadOrInitState()
  let changed = ensureFixedPhases(state)
  let result

  switch (command) {
    case 'list-projects':
      result = cmdListProjects(state)
      break
    case 'list-folders':
      result = cmdListFolders(state, args)
      break
    case 'list-tasks':
      result = cmdListTasks(state, args)
      break
    case 'show':
      result = cmdShow(state, requirePositional(args, 0, 'id'))
      break
    case 'create-project':
      result = cmdCreateProject(state, args)
      changed = true
      break
    case 'create-folder':
      result = cmdCreateFolder(state, args)
      changed = true
      break
    case 'create-task':
      result = cmdCreateTask(state, args)
      changed = true
      break
    case 'update-task':
      result = cmdUpdateTask(state, requirePositional(args, 0, 'id'), args)
      changed = true
      break
    case 'update-folder':
      result = cmdUpdateFolder(state, requirePositional(args, 0, 'id'), args)
      changed = true
      break
    case 'update-project':
      result = cmdUpdateProject(state, requirePositional(args, 0, 'id'), args)
      changed = true
      break
    case 'file-task':
      result = cmdFileTask(state, requirePositional(args, 0, 'id'), args)
      changed = true
      break
    case 'unfile-task':
      result = cmdUnfileTask(state, requirePositional(args, 0, 'id'), args)
      changed = true
      break
    case 'add-tag':
      result = cmdAddTag(state, requirePositional(args, 0, 'id'), args)
      changed = true
      break
    case 'remove-tag':
      result = cmdRemoveTag(state, requirePositional(args, 0, 'id'), args)
      changed = true
      break
    case 'add-link':
      result = cmdAddLink(state, requirePositional(args, 0, 'id'), args)
      changed = true
      break
    case 'delete-task':
      result = cmdDeleteTask(state, requirePositional(args, 0, 'id'))
      changed = true
      break
    case 'delete-folder':
      result = cmdDeleteFolder(state, requirePositional(args, 0, 'id'))
      changed = true
      break
    case 'delete-project':
      result = cmdDeleteProject(state, requirePositional(args, 0, 'id'))
      changed = true
      break
    default:
      throw new CliError(`Unknown command "${command}". Run "ledger-cli.cjs help" to see available commands.`)
  }

  if (changed) store.saveState(state)

  const output = { ok: true, command, result }
  if (!READ_COMMANDS.has(command) && isLedgerRunning()) {
    output.warning =
      'Ledger appears to be running. Quit and reopen it to see these changes — otherwise its next autosave will overwrite what this command just wrote.'
  }
  console.log(JSON.stringify(output, null, 2))
}

main().catch((err) => {
  const message = err instanceof CliError ? err.message : err?.message || String(err)
  console.log(JSON.stringify({ ok: false, error: message }, null, 2))
  process.exit(1)
})
