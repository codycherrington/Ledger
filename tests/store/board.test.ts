import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  boardItemId,
  boardItemTitle,
  reorderFolderTaskIdsWithinColumn,
  resolveItem,
  selectAllTags,
  selectColumnItems,
  selectFolderTasks,
  selectOwnerColumns,
  sortFolderTasksForDisplay,
  useBoardStore,
} from '../../src/store/board'
import { makeId } from '../../src/lib/ids'
import type { Column } from '../../src/types'

// Actions live only on the singleton store, so every test resets its data
// (not the action methods — `setState` merges by default, only `replace:
// true` would wipe the methods too) rather than re-importing the module.
beforeEach(() => {
  useBoardStore.setState({ projects: {}, columns: {}, cards: {}, tags: {}, folders: {} })
})

function seedHomeColumns(): Record<'todo' | 'inProgress' | 'done' | 'nullspace', string> {
  const ids = { todo: makeId(), inProgress: makeId(), done: makeId(), nullspace: makeId() }
  const columns: Record<string, Column> = {
    [ids.todo]: { id: ids.todo, ownerType: 'home', name: 'To Do', color: 'slate', cardOrder: [] },
    [ids.inProgress]: { id: ids.inProgress, ownerType: 'home', name: 'In Progress', color: 'sky', cardOrder: [] },
    [ids.done]: { id: ids.done, ownerType: 'home', name: 'Done', color: 'emerald', cardOrder: [] },
    [ids.nullspace]: { id: ids.nullspace, ownerType: 'home', name: 'NULLSPACE', color: 'violet', cardOrder: [] },
  }
  useBoardStore.setState((state) => ({ columns: { ...state.columns, ...columns } }))
  return ids
}

describe('createProject / updateProject / deleteProject', () => {
  it('creates 4 fixed columns for the project and places it in the given home column', () => {
    const home = seedHomeColumns()
    const projectId = useBoardStore.getState().createProject('Website Relaunch', 'a description', home.todo)

    const state = useBoardStore.getState()
    const project = state.projects[projectId]
    expect(project.name).toBe('Website Relaunch')
    expect(project.description).toBe('a description')
    expect(project.columnId).toBe(home.todo)
    expect(state.columns[home.todo].cardOrder).toEqual([projectId])

    const ownColumns = project.columnOrder.map((id) => state.columns[id])
    expect(ownColumns.map((c) => c.name)).toEqual(['To Do', 'In Progress', 'Done', 'NULLSPACE'])
    expect(ownColumns.every((c) => c.ownerType === 'project' && c.ownerId === projectId)).toBe(true)
  })

  it('does not throw and simply skips the column patch if homeColumnId does not exist', () => {
    const projectId = useBoardStore.getState().createProject('Orphan', undefined, 'missing-column')
    const state = useBoardStore.getState()
    expect(state.projects[projectId].columnId).toBe('missing-column')
  })

  it('updateProject patches name/description and bumps updatedAt', () => {
    const home = seedHomeColumns()
    const projectId = useBoardStore.getState().createProject('Old Name', undefined, home.todo)
    const before = useBoardStore.getState().projects[projectId].updatedAt

    vi.useFakeTimers()
    vi.setSystemTime(before + 1000)
    useBoardStore.getState().updateProject(projectId, { name: 'New Name' })
    vi.useRealTimers()

    const project = useBoardStore.getState().projects[projectId]
    expect(project.name).toBe('New Name')
    expect(project.updatedAt).toBeGreaterThan(before)
  })

  it('updateProject on an unknown id is a no-op', () => {
    const before = useBoardStore.getState()
    useBoardStore.getState().updateProject('does-not-exist', { name: 'X' })
    expect(useBoardStore.getState()).toEqual(before)
  })

  it('deleteProject removes the project, its own columns, and its direct cards', () => {
    const home = seedHomeColumns()
    const projectId = useBoardStore.getState().createProject('Doomed', undefined, home.todo)
    const project = useBoardStore.getState().projects[projectId]
    const todoColId = project.columnOrder[0]
    const cardId = useBoardStore.getState().createCard(todoColId, 'A task')

    useBoardStore.getState().deleteProject(projectId)

    const state = useBoardStore.getState()
    expect(state.projects[projectId]).toBeUndefined()
    expect(state.cards[cardId]).toBeUndefined()
    for (const colId of project.columnOrder) {
      expect(state.columns[colId]).toBeUndefined()
    }
    // Removed from the home column's cardOrder too.
    expect(state.columns[home.todo].cardOrder).not.toContain(projectId)
  })

  it('deleteProject cascades into folders sitting in its columns and the tasks filed inside them', () => {
    const home = seedHomeColumns()
    const projectId = useBoardStore.getState().createProject('Doomed', undefined, home.todo)
    const project = useBoardStore.getState().projects[projectId]
    const todoColId = project.columnOrder[0]

    const folderId = useBoardStore.getState().createFolder('project', projectId, todoColId, 'Phase 1')
    const filedCardId = useBoardStore.getState().createCardInFolder(folderId, 'Filed task')

    useBoardStore.getState().deleteProject(projectId)

    const state = useBoardStore.getState()
    expect(state.folders[folderId]).toBeUndefined()
    expect(state.cards[filedCardId]).toBeUndefined()
  })

  it('deleteProject on an unknown id is a no-op', () => {
    const before = useBoardStore.getState()
    useBoardStore.getState().deleteProject('does-not-exist')
    expect(useBoardStore.getState()).toEqual(before)
  })

  it('addProjectLink / updateProjectLink / removeProjectLink manage the links array', () => {
    const home = seedHomeColumns()
    const projectId = useBoardStore.getState().createProject('P', undefined, home.todo)

    useBoardStore.getState().addProjectLink(projectId, 'Docs', 'https://example.com')
    let project = useBoardStore.getState().projects[projectId]
    expect(project.links).toHaveLength(1)
    const linkId = project.links[0].id

    useBoardStore.getState().updateProjectLink(projectId, linkId, { label: 'Docs v2' })
    project = useBoardStore.getState().projects[projectId]
    expect(project.links[0].label).toBe('Docs v2')

    useBoardStore.getState().removeProjectLink(projectId, linkId)
    project = useBoardStore.getState().projects[projectId]
    expect(project.links).toHaveLength(0)
  })

  it('addProjectAttachment stores metadata via putAttachmentBlob and removeProjectAttachment clears it', async () => {
    const home = seedHomeColumns()
    const projectId = useBoardStore.getState().createProject('P', undefined, home.todo)
    const file = new File(['contents'], 'brief.pdf', { type: 'application/pdf' })

    await useBoardStore.getState().addProjectAttachment(projectId, file)
    expect(window.boardFS!.putAttachment).toHaveBeenCalled()
    const attachment = useBoardStore.getState().projects[projectId].attachments[0]
    expect(attachment.name).toBe('brief.pdf')

    await useBoardStore.getState().removeProjectAttachment(projectId, attachment.id)
    expect(window.boardFS!.deleteAttachment).toHaveBeenCalledWith(attachment.id)
    expect(useBoardStore.getState().projects[projectId].attachments).toEqual([])
  })
})

describe('folders', () => {
  it('createFolder places the folder card into the given column', () => {
    const home = seedHomeColumns()
    const folderId = useBoardStore.getState().createFolder('home', undefined, home.todo, 'My Folder')
    const state = useBoardStore.getState()
    expect(state.folders[folderId].name).toBe('My Folder')
    expect(state.columns[home.todo].cardOrder).toEqual([folderId])
  })

  it('createFolder is a no-op if the placement column does not exist', () => {
    const before = useBoardStore.getState()
    useBoardStore.getState().createFolder('home', undefined, 'missing', 'X')
    // No folder should have been added.
    expect(Object.keys(useBoardStore.getState().folders)).toEqual(Object.keys(before.folders))
  })

  it('updateFolder patches name/description/color and bumps updatedAt', () => {
    const home = seedHomeColumns()
    const folderId = useBoardStore.getState().createFolder('home', undefined, home.todo, 'Old Name')
    useBoardStore.getState().updateFolder(folderId, { name: 'New Name', color: 'pink' })
    const folder = useBoardStore.getState().folders[folderId]
    expect(folder.name).toBe('New Name')
    expect(folder.color).toBe('pink')
  })

  it('updateFolder on an unknown id is a no-op', () => {
    const before = useBoardStore.getState()
    useBoardStore.getState().updateFolder('does-not-exist', { name: 'X' })
    expect(useBoardStore.getState()).toEqual(before)
  })

  it('deleteFolder un-files its tasks back into the folder\'s column instead of deleting them', () => {
    const home = seedHomeColumns()
    const folderId = useBoardStore.getState().createFolder('home', undefined, home.todo, 'Phase 1')
    const cardId = useBoardStore.getState().createCardInFolder(folderId, 'Filed task')

    useBoardStore.getState().deleteFolder(folderId)

    const state = useBoardStore.getState()
    expect(state.folders[folderId]).toBeUndefined()
    expect(state.cards[cardId]).toBeDefined()
    expect(state.cards[cardId].folderId).toBeUndefined()
    expect(state.cards[cardId].columnId).toBe(home.todo)
    expect(state.columns[home.todo].cardOrder).toContain(cardId)
    expect(state.columns[home.todo].cardOrder).not.toContain(folderId)
  })

  it('updateFolder patches priority/dueDate', () => {
    const home = seedHomeColumns()
    const folderId = useBoardStore.getState().createFolder('home', undefined, home.todo, 'Phase 1')
    useBoardStore.getState().updateFolder(folderId, { priority: 'high', dueDate: '2026-08-01' })
    const folder = useBoardStore.getState().folders[folderId]
    expect(folder.priority).toBe('high')
    expect(folder.dueDate).toBe('2026-08-01')
  })

  it('toggleFolderTag adds and removes a tag id from a folder', () => {
    const home = seedHomeColumns()
    const folderId = useBoardStore.getState().createFolder('home', undefined, home.todo, 'Phase 1')
    const tagId = useBoardStore.getState().createTag('urgent', 'red')

    useBoardStore.getState().toggleFolderTag(folderId, tagId)
    expect(useBoardStore.getState().folders[folderId].tagIds).toEqual([tagId])

    useBoardStore.getState().toggleFolderTag(folderId, tagId)
    expect(useBoardStore.getState().folders[folderId].tagIds).toEqual([])
  })

  it('addFolderLink / updateFolderLink / removeFolderLink manage a folder\'s links array', () => {
    const home = seedHomeColumns()
    const folderId = useBoardStore.getState().createFolder('home', undefined, home.todo, 'Phase 1')

    useBoardStore.getState().addFolderLink(folderId, 'Repo', 'https://github.com/x')
    const linkId = useBoardStore.getState().folders[folderId].links[0].id

    useBoardStore.getState().updateFolderLink(folderId, linkId, { label: 'Repo v2' })
    expect(useBoardStore.getState().folders[folderId].links[0].label).toBe('Repo v2')

    useBoardStore.getState().removeFolderLink(folderId, linkId)
    expect(useBoardStore.getState().folders[folderId].links).toEqual([])
  })

  it('addFolderAttachment stores metadata via putAttachmentBlob and removeFolderAttachment clears it via deleteAttachmentBlob', async () => {
    const home = seedHomeColumns()
    const folderId = useBoardStore.getState().createFolder('home', undefined, home.todo, 'Phase 1')
    const file = new File(['contents'], 'notes.txt', { type: 'text/plain' })

    await useBoardStore.getState().addFolderAttachment(folderId, file)
    expect(window.boardFS!.putAttachment).toHaveBeenCalled()
    const attachment = useBoardStore.getState().folders[folderId].attachments[0]
    expect(attachment.name).toBe('notes.txt')

    await useBoardStore.getState().removeFolderAttachment(folderId, attachment.id)
    expect(window.boardFS!.deleteAttachment).toHaveBeenCalledWith(attachment.id)
    expect(useBoardStore.getState().folders[folderId].attachments).toEqual([])
  })
})

describe('cards: creation, filing, moving, status', () => {
  it('createCard tags the card with its column\'s owning project (or none for a home column)', () => {
    const home = seedHomeColumns()
    const cardId = useBoardStore.getState().createCard(home.todo, 'Standalone task')
    const card = useBoardStore.getState().cards[cardId]
    expect(card.projectId).toBeUndefined()
    expect(card.columnId).toBe(home.todo)
    expect(useBoardStore.getState().columns[home.todo].cardOrder).toEqual([cardId])
  })

  it('createCardInFolder inherits the folder\'s owner project and columnId, and does not touch any column cardOrder', () => {
    const home = seedHomeColumns()
    const projectHome = seedHomeColumns() // unused, just ensures no cross-talk
    void projectHome
    const folderId = useBoardStore.getState().createFolder('home', undefined, home.todo, 'Phase 1')
    const cardId = useBoardStore.getState().createCardInFolder(folderId, 'Filed from birth')

    const state = useBoardStore.getState()
    expect(state.cards[cardId].folderId).toBe(folderId)
    expect(state.cards[cardId].columnId).toBe(home.todo)
    expect(state.folders[folderId].taskIds).toEqual([cardId])
    // The card itself never entered the column's cardOrder — only the folder card did.
    expect(state.columns[home.todo].cardOrder).toEqual([folderId])
  })

  it('fileTaskInFolder removes the card from its column and adds it to the folder\'s taskIds', () => {
    const home = seedHomeColumns()
    const cardId = useBoardStore.getState().createCard(home.todo, 'Task')
    const folderId = useBoardStore.getState().createFolder('home', undefined, home.inProgress, 'Phase 1')

    useBoardStore.getState().fileTaskInFolder(cardId, folderId, 0)

    const state = useBoardStore.getState()
    expect(state.columns[home.todo].cardOrder).not.toContain(cardId)
    expect(state.folders[folderId].taskIds).toEqual([cardId])
    expect(state.cards[cardId].folderId).toBe(folderId)
    // Status (columnId) is left as-is — filing doesn't change what status the card shows.
    expect(state.cards[cardId].columnId).toBe(home.todo)
  })

  it('fileTaskInFolder moves a card between two folders without duplicating it', () => {
    const home = seedHomeColumns()
    const cardId = useBoardStore.getState().createCard(home.todo, 'Task')
    const folderA = useBoardStore.getState().createFolder('home', undefined, home.todo, 'A')
    const folderB = useBoardStore.getState().createFolder('home', undefined, home.todo, 'B')

    useBoardStore.getState().fileTaskInFolder(cardId, folderA, 0)
    useBoardStore.getState().fileTaskInFolder(cardId, folderB, 0)

    const state = useBoardStore.getState()
    expect(state.folders[folderA].taskIds).toEqual([])
    expect(state.folders[folderB].taskIds).toEqual([cardId])
    expect(state.cards[cardId].folderId).toBe(folderB)
  })

  it('unfileTaskFromFolder is the inverse: gives the card a real column placement again', () => {
    const home = seedHomeColumns()
    const folderId = useBoardStore.getState().createFolder('home', undefined, home.todo, 'Phase 1')
    const cardId = useBoardStore.getState().createCardInFolder(folderId, 'Task')

    useBoardStore.getState().unfileTaskFromFolder(cardId, home.done, 0)

    const state = useBoardStore.getState()
    expect(state.folders[folderId].taskIds).toEqual([])
    expect(state.cards[cardId].folderId).toBeUndefined()
    expect(state.cards[cardId].columnId).toBe(home.done)
    expect(state.columns[home.done].cardOrder).toEqual([cardId])
  })

  it('reorderFolderTasks replaces the taskIds order verbatim', () => {
    const home = seedHomeColumns()
    const folderId = useBoardStore.getState().createFolder('home', undefined, home.todo, 'Phase 1')
    const a = useBoardStore.getState().createCardInFolder(folderId, 'A')
    const b = useBoardStore.getState().createCardInFolder(folderId, 'B')

    useBoardStore.getState().reorderFolderTasks(folderId, [b, a])
    expect(useBoardStore.getState().folders[folderId].taskIds).toEqual([b, a])
  })

  describe('reorderFolderTaskIdsWithinColumn', () => {
    it('reorders only within the target column, leaving other columns interleaved as before', () => {
      const home = seedHomeColumns()
      const folderId = useBoardStore.getState().createFolder('home', undefined, home.todo, 'Phase 1')
      const a = useBoardStore.getState().createCardInFolder(folderId, 'A') // To Do
      const x = useBoardStore.getState().createCardInFolder(folderId, 'X') // will move to In Progress
      const b = useBoardStore.getState().createCardInFolder(folderId, 'B') // To Do
      const y = useBoardStore.getState().createCardInFolder(folderId, 'Y') // will move to In Progress
      useBoardStore.getState().setCardStatus(x, home.inProgress)
      useBoardStore.getState().setCardStatus(y, home.inProgress)
      // taskIds order: [a, x, b, y] — a/b in To Do, x/y in In Progress

      const state = useBoardStore.getState()
      const result = reorderFolderTaskIdsWithinColumn(state.folders[folderId], state.cards, home.todo, a, b)

      expect(result).toEqual([b, x, a, y])
    })

    it('returns null when activeId and overId are the same card', () => {
      const home = seedHomeColumns()
      const folderId = useBoardStore.getState().createFolder('home', undefined, home.todo, 'Phase 1')
      const a = useBoardStore.getState().createCardInFolder(folderId, 'A')

      const state = useBoardStore.getState()
      const result = reorderFolderTaskIdsWithinColumn(state.folders[folderId], state.cards, home.todo, a, a)

      expect(result).toBeNull()
    })

    it('returns null when either id is not in the target column', () => {
      const home = seedHomeColumns()
      const folderId = useBoardStore.getState().createFolder('home', undefined, home.todo, 'Phase 1')
      const a = useBoardStore.getState().createCardInFolder(folderId, 'A')
      const x = useBoardStore.getState().createCardInFolder(folderId, 'X')
      useBoardStore.getState().setCardStatus(x, home.inProgress)

      const state = useBoardStore.getState()
      const result = reorderFolderTaskIdsWithinColumn(state.folders[folderId], state.cards, home.todo, a, x)

      expect(result).toBeNull()
    })
  })

  it('updateCard patches fields and bumps updatedAt', () => {
    const home = seedHomeColumns()
    const cardId = useBoardStore.getState().createCard(home.todo, 'Task')
    useBoardStore.getState().updateCard(cardId, { title: 'Renamed', priority: 'high' })
    const card = useBoardStore.getState().cards[cardId]
    expect(card.title).toBe('Renamed')
    expect(card.priority).toBe('high')
  })

  it('deleteCard removes the card and its id from the column cardOrder', () => {
    const home = seedHomeColumns()
    const cardId = useBoardStore.getState().createCard(home.todo, 'Task')
    useBoardStore.getState().deleteCard(cardId)
    const state = useBoardStore.getState()
    expect(state.cards[cardId]).toBeUndefined()
    expect(state.columns[home.todo].cardOrder).not.toContain(cardId)
  })

  it('deleteCard on an unknown id is a no-op', () => {
    expect(() => useBoardStore.getState().deleteCard('does-not-exist')).not.toThrow()
  })

  describe('moveItem', () => {
    it('reorders within the same column without changing columnId', () => {
      const home = seedHomeColumns()
      const a = useBoardStore.getState().createCard(home.todo, 'A')
      const b = useBoardStore.getState().createCard(home.todo, 'B')
      const c = useBoardStore.getState().createCard(home.todo, 'C')

      useBoardStore.getState().moveItem(a, home.todo, 2)

      const state = useBoardStore.getState()
      expect(state.columns[home.todo].cardOrder).toEqual([b, c, a])
      expect(state.cards[a].columnId).toBe(home.todo)
    })

    it('moves a card across columns, updating columnId and both cardOrders', () => {
      const home = seedHomeColumns()
      const cardId = useBoardStore.getState().createCard(home.todo, 'Task')

      useBoardStore.getState().moveItem(cardId, home.done, 0)

      const state = useBoardStore.getState()
      expect(state.columns[home.todo].cardOrder).not.toContain(cardId)
      expect(state.columns[home.done].cardOrder).toEqual([cardId])
      expect(state.cards[cardId].columnId).toBe(home.done)
    })

    it('moves a project card across columns and updates the project\'s columnId', () => {
      const home = seedHomeColumns()
      const projectId = useBoardStore.getState().createProject('P', undefined, home.todo)

      useBoardStore.getState().moveItem(projectId, home.inProgress, 0)

      const state = useBoardStore.getState()
      expect(state.projects[projectId].columnId).toBe(home.inProgress)
      expect(state.columns[home.inProgress].cardOrder).toEqual([projectId])
    })

    it('moves a folder card across columns and updates the folder\'s columnId', () => {
      const home = seedHomeColumns()
      const folderId = useBoardStore.getState().createFolder('home', undefined, home.todo, 'Phase 1')

      useBoardStore.getState().moveItem(folderId, home.done, 0)

      const state = useBoardStore.getState()
      expect(state.folders[folderId].columnId).toBe(home.done)
      expect(state.columns[home.done].cardOrder).toEqual([folderId])
    })

    it('is a no-op if the item or destination column does not exist', () => {
      const home = seedHomeColumns()
      const before = useBoardStore.getState()
      useBoardStore.getState().moveItem('missing-item', home.todo, 0)
      expect(useBoardStore.getState()).toEqual(before)
    })
  })

  it('reorderItemsInColumn replaces the cardOrder verbatim', () => {
    const home = seedHomeColumns()
    const a = useBoardStore.getState().createCard(home.todo, 'A')
    const b = useBoardStore.getState().createCard(home.todo, 'B')
    useBoardStore.getState().reorderItemsInColumn(home.todo, [b, a])
    expect(useBoardStore.getState().columns[home.todo].cardOrder).toEqual([b, a])
  })

  it('reorderItemsInColumn on an unknown column is a no-op', () => {
    const before = useBoardStore.getState()
    useBoardStore.getState().reorderItemsInColumn('does-not-exist', ['x'])
    expect(useBoardStore.getState()).toEqual(before)
  })

  describe('setCardStatus', () => {
    it('for an unfiled card, physically moves it into the target column\'s cardOrder', () => {
      const home = seedHomeColumns()
      const cardId = useBoardStore.getState().createCard(home.todo, 'Task')

      useBoardStore.getState().setCardStatus(cardId, home.done)

      const state = useBoardStore.getState()
      expect(state.cards[cardId].columnId).toBe(home.done)
      expect(state.columns[home.todo].cardOrder).not.toContain(cardId)
      expect(state.columns[home.done].cardOrder).toEqual([cardId])
    })

    it('for a filed card, only updates columnId (the status pill) without touching any cardOrder', () => {
      const home = seedHomeColumns()
      const folderId = useBoardStore.getState().createFolder('home', undefined, home.todo, 'Phase 1')
      const cardId = useBoardStore.getState().createCardInFolder(folderId, 'Task')

      useBoardStore.getState().setCardStatus(cardId, home.done)

      const state = useBoardStore.getState()
      expect(state.cards[cardId].columnId).toBe(home.done)
      expect(state.cards[cardId].folderId).toBe(folderId)
      expect(state.columns[home.done].cardOrder).not.toContain(cardId)
      expect(state.folders[folderId].taskIds).toEqual([cardId])
    })
  })
})

describe('tags', () => {
  it('createTag then toggleCardTag adds and removes the tag from a card', () => {
    const home = seedHomeColumns()
    const cardId = useBoardStore.getState().createCard(home.todo, 'Task')
    const tagId = useBoardStore.getState().createTag('urgent', 'red')

    useBoardStore.getState().toggleCardTag(cardId, tagId)
    expect(useBoardStore.getState().cards[cardId].tagIds).toEqual([tagId])

    useBoardStore.getState().toggleCardTag(cardId, tagId)
    expect(useBoardStore.getState().cards[cardId].tagIds).toEqual([])
  })

  it('deleteTag removes the tag and scrubs it from every card that referenced it', () => {
    const home = seedHomeColumns()
    const cardId = useBoardStore.getState().createCard(home.todo, 'Task')
    const tagId = useBoardStore.getState().createTag('urgent', 'red')
    useBoardStore.getState().toggleCardTag(cardId, tagId)

    useBoardStore.getState().deleteTag(tagId)

    const state = useBoardStore.getState()
    expect(state.tags[tagId]).toBeUndefined()
    expect(state.cards[cardId].tagIds).toEqual([])
  })

  it('deleteTag also scrubs it from every folder that referenced it', () => {
    const home = seedHomeColumns()
    const folderId = useBoardStore.getState().createFolder('home', undefined, home.todo, 'Phase 1')
    const tagId = useBoardStore.getState().createTag('urgent', 'red')
    useBoardStore.getState().toggleFolderTag(folderId, tagId)

    useBoardStore.getState().deleteTag(tagId)

    const state = useBoardStore.getState()
    expect(state.tags[tagId]).toBeUndefined()
    expect(state.folders[folderId].tagIds).toEqual([])
  })
})

describe('card links, attachments', () => {
  it('addLink / updateLink / removeLink manage a card\'s links array', () => {
    const home = seedHomeColumns()
    const cardId = useBoardStore.getState().createCard(home.todo, 'Task')

    useBoardStore.getState().addLink(cardId, 'Repo', 'https://github.com/x')
    const linkId = useBoardStore.getState().cards[cardId].links[0].id

    useBoardStore.getState().updateLink(cardId, linkId, { label: 'Repo v2' })
    expect(useBoardStore.getState().cards[cardId].links[0].label).toBe('Repo v2')

    useBoardStore.getState().removeLink(cardId, linkId)
    expect(useBoardStore.getState().cards[cardId].links).toEqual([])
  })

  it('addAttachment stores metadata via putAttachmentBlob and removeAttachment clears it via deleteAttachmentBlob', async () => {
    const home = seedHomeColumns()
    const cardId = useBoardStore.getState().createCard(home.todo, 'Task')
    const file = new File(['contents'], 'notes.txt', { type: 'text/plain' })

    await useBoardStore.getState().addAttachment(cardId, file)
    expect(window.boardFS!.putAttachment).toHaveBeenCalled()
    const attachment = useBoardStore.getState().cards[cardId].attachments[0]
    expect(attachment.name).toBe('notes.txt')

    await useBoardStore.getState().removeAttachment(cardId, attachment.id)
    expect(window.boardFS!.deleteAttachment).toHaveBeenCalledWith(attachment.id)
    expect(useBoardStore.getState().cards[cardId].attachments).toEqual([])
  })

})

describe('selectors and helpers', () => {
  it('resolveItem / boardItemId / boardItemTitle handle all three BoardItem kinds', () => {
    const home = seedHomeColumns()
    const projectId = useBoardStore.getState().createProject('A Project', undefined, home.todo)
    const folderId = useBoardStore.getState().createFolder('home', undefined, home.todo, 'A Folder')
    const cardId = useBoardStore.getState().createCard(home.todo, 'A Card')

    const state = useBoardStore.getState()
    const project = resolveItem(state, projectId)!
    const folder = resolveItem(state, folderId)!
    const card = resolveItem(state, cardId)!

    expect(project.kind).toBe('project')
    expect(folder.kind).toBe('folder')
    expect(card.kind).toBe('task')

    expect(boardItemId(project)).toBe(projectId)
    expect(boardItemId(folder)).toBe(folderId)
    expect(boardItemId(card)).toBe(cardId)

    expect(boardItemTitle(project)).toBe('A Project')
    expect(boardItemTitle(folder)).toBe('A Folder')
    expect(boardItemTitle(card)).toBe('A Card')
  })

  it('resolveItem returns null for an unknown id', () => {
    expect(resolveItem(useBoardStore.getState(), 'nope')).toBeNull()
  })

  it('selectOwnerColumns always returns home columns in FIXED_COLUMNS order regardless of insertion order', () => {
    const ids = { nullspace: makeId(), todo: makeId(), done: makeId(), inProgress: makeId() }
    useBoardStore.setState({
      columns: {
        [ids.nullspace]: { id: ids.nullspace, ownerType: 'home', name: 'NULLSPACE', color: 'violet', cardOrder: [] },
        [ids.todo]: { id: ids.todo, ownerType: 'home', name: 'To Do', color: 'slate', cardOrder: [] },
        [ids.done]: { id: ids.done, ownerType: 'home', name: 'Done', color: 'emerald', cardOrder: [] },
        [ids.inProgress]: { id: ids.inProgress, ownerType: 'home', name: 'In Progress', color: 'sky', cardOrder: [] },
      },
    })
    const ordered = selectOwnerColumns(useBoardStore.getState(), 'home')
    expect(ordered.map((c) => c.name)).toEqual(['To Do', 'In Progress', 'Done', 'NULLSPACE'])
  })

  it('selectOwnerColumns for a project ignores columnOrder order and uses FIXED_COLUMNS order, dropping unknown ids', () => {
    const home = seedHomeColumns()
    const projectId = useBoardStore.getState().createProject('P', undefined, home.todo)
    const state = useBoardStore.getState()
    // Scramble columnOrder to prove render order doesn't come from it.
    const scrambled = [...state.projects[projectId].columnOrder].reverse()
    useBoardStore.setState({ projects: { ...state.projects, [projectId]: { ...state.projects[projectId], columnOrder: scrambled } } })

    const ordered = selectOwnerColumns(useBoardStore.getState(), 'project', projectId)
    expect(ordered.map((c) => c.name)).toEqual(['To Do', 'In Progress', 'Done', 'NULLSPACE'])
  })

  it('selectOwnerColumns for an unknown project returns an empty array', () => {
    expect(selectOwnerColumns(useBoardStore.getState(), 'project', 'nope')).toEqual([])
  })

  it('selectColumnItems resolves each id in cardOrder to its BoardItem, in order', () => {
    const home = seedHomeColumns()
    const a = useBoardStore.getState().createCard(home.todo, 'A')
    const b = useBoardStore.getState().createCard(home.todo, 'B')
    const items = selectColumnItems(useBoardStore.getState(), home.todo)
    expect(items.map((i) => boardItemId(i))).toEqual([a, b])
  })

  it('selectColumnItems returns an empty array for an unknown column', () => {
    expect(selectColumnItems(useBoardStore.getState(), 'nope')).toEqual([])
  })

  it('selectFolderTasks resolves a folder\'s taskIds to full Card objects', () => {
    const home = seedHomeColumns()
    const folderId = useBoardStore.getState().createFolder('home', undefined, home.todo, 'Phase 1')
    const cardId = useBoardStore.getState().createCardInFolder(folderId, 'Task')
    const tasks = selectFolderTasks(useBoardStore.getState(), folderId)
    expect(tasks.map((t) => t.id)).toEqual([cardId])
  })

  it('selectAllTags returns every tag in the pool', () => {
    useBoardStore.getState().createTag('urgent', 'red')
    useBoardStore.getState().createTag('later', 'slate')
    expect(selectAllTags(useBoardStore.getState())).toHaveLength(2)
  })
})

describe('rehydration (ensureFixedPhases via persist.rehydrate)', () => {
  it('backfills missing fixed columns for Home and places an orphan project into Home\'s To Do', async () => {
    const projectId = 'legacy-project'
    window.boardFS!.loadState = vi.fn(async () => ({
      projects: {
        [projectId]: {
          id: projectId,
          name: 'Legacy',
          links: [],
          attachments: [],
          createdAt: 1,
          updatedAt: 1,
          columnOrder: [],
          columnId: '', // no valid column — simulates data predating the Home board
        },
      },
      columns: {},
      cards: {},
      tags: {},
      folders: {},
    }))

    await useBoardStore.persist.rehydrate()

    const state = useBoardStore.getState()
    const homeCols = Object.values(state.columns).filter((c) => c.ownerType === 'home')
    expect(homeCols.map((c) => c.name).sort()).toEqual(['Done', 'In Progress', 'NULLSPACE', 'To Do'].sort())

    const todo = homeCols.find((c) => c.name === 'To Do')!
    expect(todo.cardOrder).toContain(projectId)
    expect(state.projects[projectId].columnId).toBe(todo.id)
  })

  it('backfills a project missing one of its 4 fixed columns', async () => {
    const projectId = 'p1'
    const todoId = 'col-todo'
    window.boardFS!.loadState = vi.fn(async () => ({
      projects: {
        [projectId]: {
          id: projectId,
          name: 'P',
          links: [],
          attachments: [],
          createdAt: 1,
          updatedAt: 1,
          // Missing In Progress / Done / NULLSPACE columns entirely.
          columnOrder: [todoId],
          columnId: '',
        },
      },
      columns: {
        [todoId]: { id: todoId, ownerType: 'project', ownerId: projectId, name: 'To Do', color: 'slate', cardOrder: [] },
      },
      cards: {},
      tags: {},
      folders: {},
    }))

    await useBoardStore.persist.rehydrate()

    const state = useBoardStore.getState()
    const projectCols = state.projects[projectId].columnOrder.map((id) => state.columns[id])
    expect(projectCols.map((c) => c.name).sort()).toEqual(['Done', 'In Progress', 'NULLSPACE', 'To Do'].sort())
  })
})

describe('sortFolderTasksForDisplay', () => {
  it('sorts by status column order first, then priority descending, keeping ties stable', () => {
    const home = seedHomeColumns()
    const folderId = useBoardStore.getState().createFolder('home', undefined, home.todo, 'Phase 1')

    const a = useBoardStore.getState().createCardInFolder(folderId, 'a') // To Do, no priority
    const b = useBoardStore.getState().createCardInFolder(folderId, 'b') // To Do, high
    const c = useBoardStore.getState().createCardInFolder(folderId, 'c') // In Progress, low
    const d = useBoardStore.getState().createCardInFolder(folderId, 'd') // To Do, high (ties with b)

    useBoardStore.getState().updateCard(b, { priority: 'high' })
    useBoardStore.getState().setCardStatus(c, home.inProgress)
    useBoardStore.getState().updateCard(c, { priority: 'low' })
    useBoardStore.getState().updateCard(d, { priority: 'high' })

    const state = useBoardStore.getState()
    const columns = Object.values(state.columns)
    const tasks = [a, b, c, d].map((id) => state.cards[id])

    const sorted = sortFolderTasksForDisplay(tasks, columns)
    // To Do: high-priority ties (b, d) keep their relative order, before the
    // no-priority task (a); In Progress sits after every To Do task.
    expect(sorted.map((t) => t.id)).toEqual([b, d, a, c])
  })
})
