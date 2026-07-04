import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Card, ChecklistItem, Column, Priority, Project, ResourceLink, Tag } from '../types'
import { makeId } from '../lib/ids'
import { boardStorage } from './persist'
import { deleteAttachmentBlob, putAttachmentBlob } from './attachments'

interface BoardState {
  projects: Record<string, Project>
  columns: Record<string, Column>
  cards: Record<string, Card>
  tags: Record<string, Tag>

  createProject: (name: string, description?: string) => string
  updateProject: (id: string, patch: Partial<Pick<Project, 'name' | 'description'>>) => void
  deleteProject: (id: string) => void

  createCard: (projectId: string, columnId: string, title: string) => string
  updateCard: (
    id: string,
    patch: Partial<Pick<Card, 'title' | 'summary' | 'priority' | 'dueDate'>>,
  ) => void
  deleteCard: (id: string) => void
  moveCard: (cardId: string, toColumnId: string, toIndex: number) => void
  reorderCardsInColumn: (columnId: string, newOrder: string[]) => void

  createTag: (projectId: string, name: string, color: Tag['color']) => string
  deleteTag: (id: string) => void
  toggleCardTag: (cardId: string, tagId: string) => void

  addLink: (cardId: string, label: string, url: string) => void
  updateLink: (cardId: string, linkId: string, patch: Partial<Pick<ResourceLink, 'label' | 'url'>>) => void
  removeLink: (cardId: string, linkId: string) => void

  addAttachment: (cardId: string, file: File) => Promise<void>
  removeAttachment: (cardId: string, attachmentId: string) => Promise<void>

  addChecklistItem: (cardId: string, text: string) => void
  toggleChecklistItem: (cardId: string, itemId: string) => void
  removeChecklistItem: (cardId: string, itemId: string) => void
}

const FIXED_COLUMNS: { name: string; color: Column['color'] }[] = [
  { name: 'To Do', color: 'slate' },
  { name: 'In Progress', color: 'sky' },
  { name: 'Done', color: 'emerald' },
  { name: 'NULLSPACE', color: 'violet' },
]

// Backfills any fixed column missing from a project (e.g. NULLSPACE on
// pre-existing data). Idempotent — returns null once every project already
// has all four. `columnOrder` is only touched as a membership list here;
// render order is always derived from FIXED_COLUMNS, never from this array.
function ensureFixedPhases(
  state: Pick<BoardState, 'projects' | 'columns'>,
): Pick<BoardState, 'projects' | 'columns'> | null {
  let changed = false
  const projects = { ...state.projects }
  const columns = { ...state.columns }

  for (const [projectId, project] of Object.entries(projects)) {
    const namesPresent = new Set(
      project.columnOrder
        .map((id) => columns[id])
        .filter((c): c is Column => Boolean(c))
        .map((c) => c.name),
    )
    let columnOrder = project.columnOrder
    for (const def of FIXED_COLUMNS) {
      if (!namesPresent.has(def.name)) {
        const colId = makeId()
        columns[colId] = { id: colId, projectId, name: def.name, color: def.color, cardOrder: [] }
        columnOrder = [...columnOrder, colId]
        changed = true
      }
    }
    if (columnOrder !== project.columnOrder) {
      projects[projectId] = { ...project, columnOrder }
    }
  }

  return changed ? { projects, columns } : null
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
      projects: {},
      columns: {},
      cards: {},
      tags: {},

      createProject: (name, description) => {
        const id = makeId()
        const now = Date.now()
        const columns: Record<string, Column> = {}
        const columnOrder: string[] = []
        for (const def of FIXED_COLUMNS) {
          const colId = makeId()
          columns[colId] = { id: colId, projectId: id, name: def.name, color: def.color, cardOrder: [] }
          columnOrder.push(colId)
        }
        const project: Project = { id, name, description, createdAt: now, updatedAt: now, columnOrder }
        set((state) => ({
          projects: { ...state.projects, [id]: project },
          columns: { ...state.columns, ...columns },
        }))
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

        const columnIds = project.columnOrder
        const cardIds = Object.values(state.cards)
          .filter((c) => c.projectId === id)
          .map((c) => c.id)
        const attachmentIds = cardIds.flatMap(
          (cardId) => state.cards[cardId]?.attachments.map((a) => a.id) ?? [],
        )
        void Promise.all(attachmentIds.map((aid) => deleteAttachmentBlob(aid)))

        set((s) => {
          const projects = { ...s.projects }
          delete projects[id]
          const columns = { ...s.columns }
          for (const cid of columnIds) delete columns[cid]
          const cards = { ...s.cards }
          for (const cardId of cardIds) delete cards[cardId]
          const tags = { ...s.tags }
          for (const [tid, tag] of Object.entries(s.tags)) {
            if (tag.projectId === id) delete tags[tid]
          }
          return { projects, columns, cards, tags }
        })
      },

      createCard: (projectId, columnId, title) => {
        const id = makeId()
        const now = Date.now()
        const card: Card = {
          id,
          projectId,
          columnId,
          title,
          tagIds: [],
          links: [],
          attachments: [],
          checklist: [],
          createdAt: now,
          updatedAt: now,
        }
        set((state) => {
          const column = state.columns[columnId]
          if (!column) return state
          return {
            cards: { ...state.cards, [id]: card },
            columns: { ...state.columns, [columnId]: { ...column, cardOrder: [...column.cardOrder, id] } },
          }
        })
        return id
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

      moveCard: (cardId, toColumnId, toIndex) => {
        set((state) => {
          const card = state.cards[cardId]
          const toColumn = state.columns[toColumnId]
          const fromColumn = state.columns[card?.columnId ?? '']
          if (!card || !toColumn || !fromColumn) return state

          const fromOrder = fromColumn.cardOrder.filter((id) => id !== cardId)

          if (fromColumn.id === toColumn.id) {
            const newOrder = fromOrder.slice()
            newOrder.splice(toIndex, 0, cardId)
            return {
              columns: { ...state.columns, [toColumn.id]: { ...toColumn, cardOrder: newOrder } },
              cards: { ...state.cards, [cardId]: { ...card, updatedAt: Date.now() } },
            }
          }

          const toOrder = toColumn.cardOrder.slice()
          toOrder.splice(toIndex, 0, cardId)
          return {
            columns: {
              ...state.columns,
              [fromColumn.id]: { ...fromColumn, cardOrder: fromOrder },
              [toColumn.id]: { ...toColumn, cardOrder: toOrder },
            },
            cards: { ...state.cards, [cardId]: { ...card, columnId: toColumnId, updatedAt: Date.now() } },
          }
        })
      },

      reorderCardsInColumn: (columnId, newOrder) => {
        set((state) => {
          const column = state.columns[columnId]
          if (!column) return state
          return { columns: { ...state.columns, [columnId]: { ...column, cardOrder: newOrder } } }
        })
      },

      createTag: (projectId, name, color) => {
        const id = makeId()
        const tag: Tag = { id, projectId, name, color }
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
          return { tags, cards }
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

      addChecklistItem: (cardId, text) => {
        set((state) => {
          const card = state.cards[cardId]
          if (!card) return state
          const item: ChecklistItem = { id: makeId(), text, done: false }
          return { cards: { ...state.cards, [cardId]: { ...card, checklist: [...card.checklist, item], updatedAt: Date.now() } } }
        })
      },

      toggleChecklistItem: (cardId, itemId) => {
        set((state) => {
          const card = state.cards[cardId]
          if (!card) return state
          const checklist = card.checklist.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it))
          return { cards: { ...state.cards, [cardId]: { ...card, checklist, updatedAt: Date.now() } } }
        })
      },

      removeChecklistItem: (cardId, itemId) => {
        set((state) => {
          const card = state.cards[cardId]
          if (!card) return state
          const checklist = card.checklist.filter((it) => it.id !== itemId)
          return { cards: { ...state.cards, [cardId]: { ...card, checklist, updatedAt: Date.now() } } }
        })
      },
    }),
    {
      name: 'tasktray-store',
      storage: boardStorage(),
      partialize: (state) => ({
        projects: state.projects,
        columns: state.columns,
        cards: state.cards,
        tags: state.tags,
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

export function selectProjectColumns(state: BoardState, projectId: string): Column[] {
  const project = state.projects[projectId]
  if (!project) return []
  const byName = new Map(
    project.columnOrder
      .map((id) => state.columns[id])
      .filter((c): c is Column => Boolean(c))
      .map((c) => [c.name, c] as const),
  )
  return FIXED_COLUMNS.map((def) => byName.get(def.name)).filter((c): c is Column => Boolean(c))
}

export function selectColumnCards(state: BoardState, columnId: string): Card[] {
  const column = state.columns[columnId]
  if (!column) return []
  return column.cardOrder.map((id) => state.cards[id]).filter((c): c is Card => Boolean(c))
}

export function selectProjectTags(state: BoardState, projectId: string): Tag[] {
  return Object.values(state.tags).filter((t) => t.projectId === projectId)
}

export function selectAllProjects(state: BoardState): Project[] {
  return Object.values(state.projects).sort((a, b) => b.createdAt - a.createdAt)
}
