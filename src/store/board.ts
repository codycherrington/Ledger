// Single flat Zustand store for the whole app: projects, columns, cards,
// tags, and folders each live in their own `Record<id, T>` map. Persisted to
// CSV files via `boardStorage()` (src/store/persist.ts) on every mutation —
// there's no separate "save" step, every action below is already durable.
//
// Column ownership: every column belongs to either the Home singleton or a
// project (`ColumnOwnerType`). Folders don't own columns — they're a flat
// `taskIds` list, not their own board — so a task's real status lives in its
// own `columnId` field even while filed in a folder (see Card.columnId).
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { arrayMove } from '@dnd-kit/sortable'
import type {
  BoardItem,
  Card,
  Column,
  ColumnOwnerType,
  Folder,
  Priority,
  Project,
  ResourceLink,
  Tag,
} from '../types'
import { makeId } from '../lib/ids'
import { nextColor } from '../lib/colors'
import { boardStorage } from './persist'
import { deleteAttachmentBlob, putAttachmentBlob } from './attachments'

interface BoardState {
  projects: Record<string, Project>
  columns: Record<string, Column>
  cards: Record<string, Card>
  tags: Record<string, Tag>
  folders: Record<string, Folder>

  createProject: (name: string, description: string | undefined, homeColumnId: string) => string
  updateProject: (id: string, patch: Partial<Pick<Project, 'name' | 'description'>>) => void
  deleteProject: (id: string) => void

  addProjectLink: (projectId: string, label: string, url: string) => void
  updateProjectLink: (projectId: string, linkId: string, patch: Partial<Pick<ResourceLink, 'label' | 'url'>>) => void
  removeProjectLink: (projectId: string, linkId: string) => void

  addProjectAttachment: (projectId: string, file: File) => Promise<void>
  removeProjectAttachment: (projectId: string, attachmentId: string) => Promise<void>

  createFolder: (ownerType: 'home' | 'project', ownerId: string | undefined, columnId: string, name: string) => string
  updateFolder: (
    id: string,
    patch: Partial<Pick<Folder, 'name' | 'description' | 'color' | 'priority' | 'dueDate'>>,
  ) => void
  deleteFolder: (id: string) => void

  toggleFolderTag: (folderId: string, tagId: string) => void

  addFolderLink: (folderId: string, label: string, url: string) => void
  updateFolderLink: (folderId: string, linkId: string, patch: Partial<Pick<ResourceLink, 'label' | 'url'>>) => void
  removeFolderLink: (folderId: string, linkId: string) => void

  addFolderAttachment: (folderId: string, file: File) => Promise<void>
  removeFolderAttachment: (folderId: string, attachmentId: string) => Promise<void>

  createCard: (columnId: string, title: string) => string
  createCardInFolder: (folderId: string, title: string) => string
  fileTaskInFolder: (cardId: string, folderId: string, toIndex: number) => void
  unfileTaskFromFolder: (cardId: string, toColumnId: string, toIndex: number) => void
  reorderFolderTasks: (folderId: string, newOrder: string[]) => void
  updateCard: (
    id: string,
    patch: Partial<Pick<Card, 'title' | 'summary' | 'priority' | 'dueDate'>>,
  ) => void
  deleteCard: (id: string) => void
  moveItem: (itemId: string, toColumnId: string, toIndex: number) => void
  reorderItemsInColumn: (columnId: string, newOrder: string[]) => void
  setCardStatus: (cardId: string, columnId: string) => void

  createTag: (name: string, color: Tag['color']) => string
  deleteTag: (id: string) => void
  toggleCardTag: (cardId: string, tagId: string) => void

  addLink: (cardId: string, label: string, url: string) => void
  updateLink: (cardId: string, linkId: string, patch: Partial<Pick<ResourceLink, 'label' | 'url'>>) => void
  removeLink: (cardId: string, linkId: string) => void

  addAttachment: (cardId: string, file: File) => Promise<void>
  removeAttachment: (cardId: string, attachmentId: string) => Promise<void>
}

const FIXED_COLUMNS: { name: string; color: Column['color'] }[] = [
  { name: 'To Do', color: 'slate' },
  { name: 'In Progress', color: 'sky' },
  { name: 'Done', color: 'emerald' },
  { name: 'NULLSPACE', color: 'violet' },
]

type OwnerState = Pick<BoardState, 'columns' | 'projects' | 'folders'>

// Backfills any fixed column missing from a board owner (home, a project, or a
// folder). Idempotent — mutates `columns` in place and returns the owner's
// updated membership order, or null if nothing was missing.
function backfillOwnerColumns(
  columns: Record<string, Column>,
  ownerType: ColumnOwnerType,
  ownerId: string | undefined,
  existingOrder: string[],
): string[] | null {
  const namesPresent = new Set(
    existingOrder
      .map((id) => columns[id])
      .filter((c): c is Column => Boolean(c))
      .map((c) => c.name),
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

// Runs on rehydrate. Ensures Home and every project's board have their 4
// fixed columns (backfilling any missing on old data), then places any
// project that isn't yet sitting in a Home column into Home's "To Do"
// column. `columnOrder` is only ever touched as a membership list — render
// order is always derived from FIXED_COLUMNS, never from this array.
// Folders don't own columns (they're a flat grouping of tasks, not their own
// board), so there's nothing to backfill for them here.
function ensureFixedPhases(state: OwnerState): OwnerState | null {
  let changed = false
  const columns = { ...state.columns }
  const projects = { ...state.projects }

  const homeExistingOrder = Object.values(columns)
    .filter((c) => c.ownerType === 'home')
    .map((c) => c.id)
  if (backfillOwnerColumns(columns, 'home', undefined, homeExistingOrder)) changed = true

  for (const [projectId, project] of Object.entries(projects)) {
    const order = backfillOwnerColumns(columns, 'project', projectId, project.columnOrder)
    if (order) {
      projects[projectId] = { ...project, columnOrder: order }
      changed = true
    }
  }

  const homeColumns = selectOwnerColumns({ columns, projects }, 'home')
  const todoColumn = homeColumns.find((c) => c.name === 'To Do')
  if (todoColumn) {
    for (const [projectId, project] of Object.entries(projects)) {
      if (project.columnId && columns[project.columnId]) continue
      projects[projectId] = { ...project, columnId: todoColumn.id }
      columns[todoColumn.id] = { ...columns[todoColumn.id], cardOrder: [...columns[todoColumn.id].cardOrder, projectId] }
      changed = true
    }
  }

  return changed ? { projects, columns, folders: state.folders } : null
}

// Everything that disappears when a project is deleted: its own 4 columns,
// the cards directly in them, any folders sitting in them, and — since the
// whole project is going away — the tasks filed inside those folders too.
function collectProjectDeletion(
  state: Pick<BoardState, 'columns' | 'cards' | 'folders'>,
  projectId: string,
): { columnIds: string[]; cardIds: string[]; folderIds: string[]; attachmentIds: string[] } {
  const columnIds = Object.values(state.columns)
    .filter((c) => c.ownerType === 'project' && c.ownerId === projectId)
    .map((c) => c.id)
  const columnIdSet = new Set(columnIds)
  const folderIds = Object.values(state.folders)
    .filter((f) => columnIdSet.has(f.columnId))
    .map((f) => f.id)
  const folderCardIds = folderIds.flatMap((fid) => state.folders[fid]?.taskIds ?? [])
  const directCardIds = Object.values(state.cards)
    .filter((c) => columnIdSet.has(c.columnId) && !c.folderId)
    .map((c) => c.id)
  const cardIds = [...directCardIds, ...folderCardIds]
  const attachmentIds = cardIds.flatMap((cardId) => state.cards[cardId]?.attachments.map((a) => a.id) ?? [])
  return { columnIds, cardIds, folderIds, attachmentIds }
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
      projects: {},
      columns: {},
      cards: {},
      tags: {},
      folders: {},

      createProject: (name, description, homeColumnId) => {
        const id = makeId()
        const now = Date.now()
        const newColumns: Record<string, Column> = {}
        const columnOrder: string[] = []
        for (const def of FIXED_COLUMNS) {
          const colId = makeId()
          newColumns[colId] = { id: colId, ownerType: 'project', ownerId: id, name: def.name, color: def.color, cardOrder: [] }
          columnOrder.push(colId)
        }
        set((state) => {
          const homeColumn = state.columns[homeColumnId]
          const project: Project = {
            id,
            name,
            description,
            links: [],
            attachments: [],
            createdAt: now,
            updatedAt: now,
            columnOrder,
            columnId: homeColumnId,
          }
          return {
            projects: { ...state.projects, [id]: project },
            columns: {
              ...state.columns,
              ...newColumns,
              ...(homeColumn ? { [homeColumnId]: { ...homeColumn, cardOrder: [...homeColumn.cardOrder, id] } } : {}),
            },
          }
        })
        return id
      },

      updateProject: (id, patch) => {
        set((state) => {
          const project = state.projects[id]
          if (!project) return state
          return {
            projects: { ...state.projects, [id]: { ...project, ...patch, updatedAt: Date.now() } },
          }
        })
      },

      deleteProject: (id) => {
        const state = get()
        const project = state.projects[id]
        if (!project) return

        const { columnIds, cardIds, folderIds, attachmentIds } = collectProjectDeletion(state, id)
        const projectAttachmentIds = project.attachments.map((a) => a.id)
        void Promise.all([...attachmentIds, ...projectAttachmentIds].map((aid) => deleteAttachmentBlob(aid)))

        set((s) => {
          const projects = { ...s.projects }
          delete projects[id]

          const columns = { ...s.columns }
          for (const cid of columnIds) delete columns[cid]
          const homeColumn = columns[project.columnId]
          if (homeColumn) {
            columns[project.columnId] = { ...homeColumn, cardOrder: homeColumn.cardOrder.filter((cid) => cid !== id) }
          }

          const cards = { ...s.cards }
          for (const cardId of cardIds) delete cards[cardId]

          const folders = { ...s.folders }
          for (const folderId of folderIds) delete folders[folderId]

          return { projects, columns, cards, folders }
        })
      },

      addProjectLink: (projectId, label, url) => {
        set((state) => {
          const project = state.projects[projectId]
          if (!project) return state
          const link: ResourceLink = { id: makeId(), label, url }
          return { projects: { ...state.projects, [projectId]: { ...project, links: [...project.links, link], updatedAt: Date.now() } } }
        })
      },

      updateProjectLink: (projectId, linkId, patch) => {
        set((state) => {
          const project = state.projects[projectId]
          if (!project) return state
          const links = project.links.map((l) => (l.id === linkId ? { ...l, ...patch } : l))
          return { projects: { ...state.projects, [projectId]: { ...project, links, updatedAt: Date.now() } } }
        })
      },

      removeProjectLink: (projectId, linkId) => {
        set((state) => {
          const project = state.projects[projectId]
          if (!project) return state
          const links = project.links.filter((l) => l.id !== linkId)
          return { projects: { ...state.projects, [projectId]: { ...project, links, updatedAt: Date.now() } } }
        })
      },

      addProjectAttachment: async (projectId, file) => {
        const id = makeId()
        await putAttachmentBlob(id, file)
        set((state) => {
          const project = state.projects[projectId]
          if (!project) return state
          const attachments = [...project.attachments, { id, name: file.name, type: file.type, size: file.size }]
          return { projects: { ...state.projects, [projectId]: { ...project, attachments, updatedAt: Date.now() } } }
        })
      },

      removeProjectAttachment: async (projectId, attachmentId) => {
        await deleteAttachmentBlob(attachmentId)
        set((state) => {
          const project = state.projects[projectId]
          if (!project) return state
          const attachments = project.attachments.filter((a) => a.id !== attachmentId)
          return { projects: { ...state.projects, [projectId]: { ...project, attachments, updatedAt: Date.now() } } }
        })
      },

      createFolder: (ownerType, ownerId, columnId, name) => {
        const id = makeId()
        const now = Date.now()
        set((state) => {
          const placementColumn = state.columns[columnId]
          if (!placementColumn) return state
          const folder: Folder = {
            id,
            ownerType,
            ownerId,
            name,
            color: nextColor(Object.keys(state.folders).length),
            tagIds: [],
            links: [],
            attachments: [],
            columnId,
            taskIds: [],
            createdAt: now,
            updatedAt: now,
          }
          return {
            folders: { ...state.folders, [id]: folder },
            columns: { ...state.columns, [columnId]: { ...placementColumn, cardOrder: [...placementColumn.cardOrder, id] } },
          }
        })
        return id
      },

      updateFolder: (id, patch) => {
        set((state) => {
          const folder = state.folders[id]
          if (!folder) return state
          return { folders: { ...state.folders, [id]: { ...folder, ...patch, updatedAt: Date.now() } } }
        })
      },

      // Folders are a lightweight grouping, not their own board — deleting one
      // un-files its tasks back into whichever column the folder itself sat
      // in, rather than destroying them.
      deleteFolder: (id) => {
        const state = get()
        const folder = state.folders[id]
        if (!folder) return
        void Promise.all(folder.attachments.map((a) => deleteAttachmentBlob(a.id)))

        set((s) => {
          const folders = { ...s.folders }
          delete folders[id]

          const columns = { ...s.columns }
          const ownerColumn = columns[folder.columnId]
          if (ownerColumn) {
            const cardOrder = ownerColumn.cardOrder.filter((cid) => cid !== id).concat(folder.taskIds)
            columns[folder.columnId] = { ...ownerColumn, cardOrder }
          }

          const cards = { ...s.cards }
          for (const cardId of folder.taskIds) {
            const card = cards[cardId]
            if (card) cards[cardId] = { ...card, folderId: undefined, columnId: folder.columnId, updatedAt: Date.now() }
          }

          return { folders, columns, cards }
        })
      },

      toggleFolderTag: (folderId, tagId) => {
        set((state) => {
          const folder = state.folders[folderId]
          if (!folder) return state
          const tagIds = folder.tagIds.includes(tagId)
            ? folder.tagIds.filter((id) => id !== tagId)
            : [...folder.tagIds, tagId]
          return { folders: { ...state.folders, [folderId]: { ...folder, tagIds, updatedAt: Date.now() } } }
        })
      },

      addFolderLink: (folderId, label, url) => {
        set((state) => {
          const folder = state.folders[folderId]
          if (!folder) return state
          const link: ResourceLink = { id: makeId(), label, url }
          return { folders: { ...state.folders, [folderId]: { ...folder, links: [...folder.links, link], updatedAt: Date.now() } } }
        })
      },

      updateFolderLink: (folderId, linkId, patch) => {
        set((state) => {
          const folder = state.folders[folderId]
          if (!folder) return state
          const links = folder.links.map((l) => (l.id === linkId ? { ...l, ...patch } : l))
          return { folders: { ...state.folders, [folderId]: { ...folder, links, updatedAt: Date.now() } } }
        })
      },

      removeFolderLink: (folderId, linkId) => {
        set((state) => {
          const folder = state.folders[folderId]
          if (!folder) return state
          const links = folder.links.filter((l) => l.id !== linkId)
          return { folders: { ...state.folders, [folderId]: { ...folder, links, updatedAt: Date.now() } } }
        })
      },

      addFolderAttachment: async (folderId, file) => {
        const id = makeId()
        await putAttachmentBlob(id, file)
        set((state) => {
          const folder = state.folders[folderId]
          if (!folder) return state
          const attachments = [...folder.attachments, { id, name: file.name, type: file.type, size: file.size }]
          return { folders: { ...state.folders, [folderId]: { ...folder, attachments, updatedAt: Date.now() } } }
        })
      },

      removeFolderAttachment: async (folderId, attachmentId) => {
        await deleteAttachmentBlob(attachmentId)
        set((state) => {
          const folder = state.folders[folderId]
          if (!folder) return state
          const attachments = folder.attachments.filter((a) => a.id !== attachmentId)
          return { folders: { ...state.folders, [folderId]: { ...folder, attachments, updatedAt: Date.now() } } }
        })
      },

      createCard: (columnId, title) => {
        const id = makeId()
        const now = Date.now()
        set((state) => {
          const column = state.columns[columnId]
          if (!column) return state
          const projectId = column.ownerType === 'project' ? column.ownerId : undefined
          const card: Card = {
            id,
            projectId,
            columnId,
            title,
            tagIds: [],
            links: [],
            attachments: [],
            createdAt: now,
            updatedAt: now,
          }
          return {
            cards: { ...state.cards, [id]: card },
            columns: { ...state.columns, [columnId]: { ...column, cardOrder: [...column.cardOrder, id] } },
          }
        })
        return id
      },

      createCardInFolder: (folderId, title) => {
        const id = makeId()
        const now = Date.now()
        set((state) => {
          const folder = state.folders[folderId]
          if (!folder) return state
          const projectId = folder.ownerType === 'project' ? folder.ownerId : undefined
          const card: Card = {
            id,
            projectId,
            folderId,
            columnId: folder.columnId,
            title,
            tagIds: [],
            links: [],
            attachments: [],
            createdAt: now,
            updatedAt: now,
          }
          return {
            cards: { ...state.cards, [id]: card },
            folders: { ...state.folders, [folderId]: { ...folder, taskIds: [...folder.taskIds, id] } },
          }
        })
        return id
      },

      // Files a task into a folder: pulls it out of its current column (if
      // any) or a different folder (if already filed elsewhere), then adds it
      // to the target folder's taskIds. Its columnId is left as-is — that's
      // now just its displayed status, not a placement.
      fileTaskInFolder: (cardId, folderId, toIndex) => {
        set((state) => {
          const card = state.cards[cardId]
          const targetFolder = state.folders[folderId]
          if (!card || !targetFolder) return state

          const columns = { ...state.columns }
          const currentColumn = columns[card.columnId]
          if (currentColumn?.cardOrder.includes(cardId)) {
            columns[card.columnId] = { ...currentColumn, cardOrder: currentColumn.cardOrder.filter((id) => id !== cardId) }
          }

          const folders = { ...state.folders }
          if (card.folderId && card.folderId !== folderId && folders[card.folderId]) {
            const prev = folders[card.folderId]
            folders[card.folderId] = { ...prev, taskIds: prev.taskIds.filter((id) => id !== cardId) }
          }

          const base = folders[folderId] ?? targetFolder
          const taskIds = base.taskIds.filter((id) => id !== cardId)
          taskIds.splice(toIndex, 0, cardId)
          folders[folderId] = { ...base, taskIds }

          return {
            columns,
            folders,
            cards: { ...state.cards, [cardId]: { ...card, folderId, updatedAt: Date.now() } },
          }
        })
      },

      // Inverse of fileTaskInFolder: removes the task from its folder and
      // gives it a real placement in a column's cardOrder, with a fresh
      // columnId to match.
      unfileTaskFromFolder: (cardId, toColumnId, toIndex) => {
        set((state) => {
          const card = state.cards[cardId]
          const toColumn = state.columns[toColumnId]
          if (!card || !toColumn) return state

          const folders = { ...state.folders }
          if (card.folderId && folders[card.folderId]) {
            const prev = folders[card.folderId]
            folders[card.folderId] = { ...prev, taskIds: prev.taskIds.filter((id) => id !== cardId) }
          }

          const order = toColumn.cardOrder.filter((id) => id !== cardId)
          order.splice(toIndex, 0, cardId)

          return {
            folders,
            columns: { ...state.columns, [toColumnId]: { ...toColumn, cardOrder: order } },
            cards: { ...state.cards, [cardId]: { ...card, folderId: undefined, columnId: toColumnId, updatedAt: Date.now() } },
          }
        })
      },

      reorderFolderTasks: (folderId, newOrder) => {
        set((state) => {
          const folder = state.folders[folderId]
          if (!folder) return state
          return { folders: { ...state.folders, [folderId]: { ...folder, taskIds: newOrder } } }
        })
      },

      updateCard: (id, patch) => {
        set((state) => {
          const card = state.cards[id]
          if (!card) return state
          return { cards: { ...state.cards, [id]: { ...card, ...patch, updatedAt: Date.now() } } }
        })
      },

      deleteCard: (id) => {
        const state = get()
        const card = state.cards[id]
        if (!card) return
        const column = state.columns[card.columnId]
        void Promise.all(card.attachments.map((a) => deleteAttachmentBlob(a.id)))

        set((s) => {
          const cards = { ...s.cards }
          delete cards[id]
          const columns = column
            ? {
                ...s.columns,
                [column.id]: { ...column, cardOrder: column.cardOrder.filter((cid) => cid !== id) },
              }
            : s.columns
          return { cards, columns }
        })
      },

      // Column-to-column move for anything currently sitting in a column's
      // cardOrder — a task, or a project/folder card being repositioned in
      // its owner board. Not for filed tasks; those go through
      // fileTaskInFolder/unfileTaskFromFolder instead, since they aren't in
      // any column's cardOrder to remove from.
      moveItem: (itemId, toColumnId, toIndex) => {
        set((state) => {
          const item = resolveItem(state, itemId)
          const toColumn = state.columns[toColumnId]
          if (!item || !toColumn) return state

          const fromColumnId =
            item.kind === 'task' ? item.card.columnId : item.kind === 'project' ? item.project.columnId : item.folder.columnId
          const fromColumn = state.columns[fromColumnId]
          if (!fromColumn) return state

          const fromOrder = fromColumn.cardOrder.filter((cid) => cid !== itemId)

          let columns: Record<string, Column>
          if (fromColumn.id === toColumn.id) {
            const newOrder = fromOrder.slice()
            newOrder.splice(toIndex, 0, itemId)
            columns = { ...state.columns, [toColumn.id]: { ...toColumn, cardOrder: newOrder } }
          } else {
            const toOrder = toColumn.cardOrder.slice()
            toOrder.splice(toIndex, 0, itemId)
            columns = {
              ...state.columns,
              [fromColumn.id]: { ...fromColumn, cardOrder: fromOrder },
              [toColumn.id]: { ...toColumn, cardOrder: toOrder },
            }
          }

          const now = Date.now()
          if (item.kind === 'task') {
            return { columns, cards: { ...state.cards, [itemId]: { ...item.card, columnId: toColumnId, updatedAt: now } } }
          }
          if (item.kind === 'project') {
            return { columns, projects: { ...state.projects, [itemId]: { ...item.project, columnId: toColumnId, updatedAt: now } } }
          }
          return { columns, folders: { ...state.folders, [itemId]: { ...item.folder, columnId: toColumnId, updatedAt: now } } }
        })
      },

      reorderItemsInColumn: (columnId, newOrder) => {
        set((state) => {
          const column = state.columns[columnId]
          if (!column) return state
          return { columns: { ...state.columns, [columnId]: { ...column, cardOrder: newOrder } } }
        })
      },

      // Changing status from the detail dialog/table (as opposed to dragging
      // on the board) needs different handling for a filed task: it isn't in
      // any column's cardOrder while filed, so there's nothing to physically
      // move — only the columnId field changes, which the status pill on the
      // card reflects. An unfiled task gets a real move, same as a drag.
      setCardStatus: (cardId, columnId) => {
        set((state) => {
          const card = state.cards[cardId]
          const toColumn = state.columns[columnId]
          if (!card || !toColumn) return state

          if (card.folderId) {
            return { cards: { ...state.cards, [cardId]: { ...card, columnId, updatedAt: Date.now() } } }
          }

          const fromColumn = state.columns[card.columnId]
          const columns = { ...state.columns }
          if (fromColumn) {
            columns[fromColumn.id] = { ...fromColumn, cardOrder: fromColumn.cardOrder.filter((id) => id !== cardId) }
          }
          const target = columns[columnId] ?? toColumn
          columns[columnId] = { ...target, cardOrder: [...target.cardOrder, cardId] }

          return {
            columns,
            cards: { ...state.cards, [cardId]: { ...card, columnId, updatedAt: Date.now() } },
          }
        })
      },

      createTag: (name, color) => {
        const id = makeId()
        const tag: Tag = { id, name, color }
        set((state) => ({ tags: { ...state.tags, [id]: tag } }))
        return id
      },

      deleteTag: (id) => {
        set((state) => {
          const tags = { ...state.tags }
          delete tags[id]
          const cards = { ...state.cards }
          for (const [cardId, card] of Object.entries(state.cards)) {
            if (card.tagIds.includes(id)) {
              cards[cardId] = { ...card, tagIds: card.tagIds.filter((tid) => tid !== id) }
            }
          }
          const folders = { ...state.folders }
          for (const [folderId, folder] of Object.entries(state.folders)) {
            if (folder.tagIds.includes(id)) {
              folders[folderId] = { ...folder, tagIds: folder.tagIds.filter((tid) => tid !== id) }
            }
          }
          return { tags, cards, folders }
        })
      },

      toggleCardTag: (cardId, tagId) => {
        set((state) => {
          const card = state.cards[cardId]
          if (!card) return state
          const tagIds = card.tagIds.includes(tagId)
            ? card.tagIds.filter((id) => id !== tagId)
            : [...card.tagIds, tagId]
          return { cards: { ...state.cards, [cardId]: { ...card, tagIds, updatedAt: Date.now() } } }
        })
      },

      addLink: (cardId, label, url) => {
        set((state) => {
          const card = state.cards[cardId]
          if (!card) return state
          const link: ResourceLink = { id: makeId(), label, url }
          return { cards: { ...state.cards, [cardId]: { ...card, links: [...card.links, link], updatedAt: Date.now() } } }
        })
      },

      updateLink: (cardId, linkId, patch) => {
        set((state) => {
          const card = state.cards[cardId]
          if (!card) return state
          const links = card.links.map((l) => (l.id === linkId ? { ...l, ...patch } : l))
          return { cards: { ...state.cards, [cardId]: { ...card, links, updatedAt: Date.now() } } }
        })
      },

      removeLink: (cardId, linkId) => {
        set((state) => {
          const card = state.cards[cardId]
          if (!card) return state
          const links = card.links.filter((l) => l.id !== linkId)
          return { cards: { ...state.cards, [cardId]: { ...card, links, updatedAt: Date.now() } } }
        })
      },

      addAttachment: async (cardId, file) => {
        const id = makeId()
        await putAttachmentBlob(id, file)
        set((state) => {
          const card = state.cards[cardId]
          if (!card) return state
          const attachments = [...card.attachments, { id, name: file.name, type: file.type, size: file.size }]
          return { cards: { ...state.cards, [cardId]: { ...card, attachments, updatedAt: Date.now() } } }
        })
      },

      removeAttachment: async (cardId, attachmentId) => {
        await deleteAttachmentBlob(attachmentId)
        set((state) => {
          const card = state.cards[cardId]
          if (!card) return state
          const attachments = card.attachments.filter((a) => a.id !== attachmentId)
          return { cards: { ...state.cards, [cardId]: { ...card, attachments, updatedAt: Date.now() } } }
        })
      },

    }),
    {
      name: 'ledger-store',
      storage: boardStorage(),
      partialize: (state) => ({
        projects: state.projects,
        columns: state.columns,
        cards: state.cards,
        tags: state.tags,
        folders: state.folders,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const patch = ensureFixedPhases(state)
        if (patch) useBoardStore.setState(patch)
      },
    },
  ),
)

// Priority type re-exported for convenience where components only need it via the store module.
export type { Priority }

export function resolveItem(state: Pick<BoardState, 'projects' | 'folders' | 'cards'>, id: string): BoardItem | null {
  if (state.folders[id]) return { kind: 'folder', folder: state.folders[id] }
  if (state.projects[id]) return { kind: 'project', project: state.projects[id] }
  if (state.cards[id]) return { kind: 'task', card: state.cards[id] }
  return null
}

export function boardItemId(item: BoardItem): string {
  switch (item.kind) {
    case 'task':
      return item.card.id
    case 'project':
      return item.project.id
    case 'folder':
      return item.folder.id
  }
}

export function boardItemTitle(item: BoardItem): string {
  switch (item.kind) {
    case 'task':
      return item.card.title
    case 'project':
      return item.project.name
    case 'folder':
      return item.folder.name
  }
}

export function selectOwnerColumns(
  state: Pick<BoardState, 'columns' | 'projects'>,
  ownerType: ColumnOwnerType,
  ownerId?: string,
): Column[] {
  if (ownerType === 'home') {
    const byName = new Map(
      Object.values(state.columns)
        .filter((c) => c.ownerType === 'home')
        .map((c) => [c.name, c] as const),
    )
    return FIXED_COLUMNS.map((def) => byName.get(def.name)).filter((c): c is Column => Boolean(c))
  }
  const project = state.projects[ownerId ?? '']
  if (!project) return []
  const byName = new Map(
    project.columnOrder
      .map((id) => state.columns[id])
      .filter((c): c is Column => Boolean(c))
      .map((c) => [c.name, c] as const),
  )
  return FIXED_COLUMNS.map((def) => byName.get(def.name)).filter((c): c is Column => Boolean(c))
}

export function selectColumnItems(
  state: Pick<BoardState, 'columns' | 'projects' | 'folders' | 'cards'>,
  columnId: string,
): BoardItem[] {
  const column = state.columns[columnId]
  if (!column) return []
  return column.cardOrder.map((id) => resolveItem(state, id)).filter((item): item is BoardItem => Boolean(item))
}

export function selectFolderTasks(state: Pick<BoardState, 'folders' | 'cards'>, folderId: string): Card[] {
  const folder = state.folders[folderId]
  if (!folder) return []
  return folder.taskIds.map((id) => state.cards[id]).filter((c): c is Card => Boolean(c))
}

export function selectAllTags(state: Pick<BoardState, 'tags'>): Tag[] {
  return Object.values(state.tags)
}

export const PRIORITY_RANK: Record<Priority, number> = { low: 0, med: 1, high: 2 }

// Status ascending (by the owner board's fixed column order), then priority
// descending (High → Medium → Low → none). Stable sort, so tasks tying on
// both keep their existing filed order — manual same-status/-priority
// ordering is preserved rather than fought. Used to order a folder's tasks
// wherever its dropdown is shown (inline in Kanban, expanded in Table view).
export function sortFolderTasksForDisplay(tasks: Card[], columns: Column[]): Card[] {
  const columnIndexById = new Map(columns.map((c, i) => [c.id, i]))
  const rank = (p?: Priority) => (p ? PRIORITY_RANK[p] : -1)
  return [...tasks].sort((a, b) => {
    const statusCmp = (columnIndexById.get(a.columnId) ?? 0) - (columnIndexById.get(b.columnId) ?? 0)
    if (statusCmp !== 0) return statusCmp
    return rank(b.priority) - rank(a.priority)
  })
}

// Reorders a folder's tasks within one status column while leaving every
// other column's relative interleaving untouched — used when dragging within
// a folder-scoped board view (FolderBoardShell), where a "column" is just a
// filter over folder.taskIds rather than a real placement. `activeId`/`overId`
// must both currently sit in `columnId` (per folder.taskIds + card.columnId).
// Returns the new full taskIds array to pass to reorderFolderTasks, or null
// if the reorder is a no-op / inputs are invalid.
export function reorderFolderTaskIdsWithinColumn(
  folder: Pick<Folder, 'taskIds'>,
  cards: Record<string, Card>,
  columnId: string,
  activeId: string,
  overId: string,
): string[] | null {
  const subset = folder.taskIds.filter((id) => cards[id]?.columnId === columnId)
  const oldIndex = subset.indexOf(activeId)
  const newIndex = subset.indexOf(overId)
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return null
  const queue = arrayMove(subset, oldIndex, newIndex)
  return folder.taskIds.map((id) => (cards[id]?.columnId === columnId ? queue.shift()! : id))
}
