export type Priority = 'low' | 'med' | 'high'

export type ColumnOwnerType = 'home' | 'project'

export interface ResourceLink {
  id: string
  label: string
  url: string
}

export interface AttachmentMeta {
  id: string
  name: string
  type: string
  size: number
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface Card {
  id: string
  projectId?: string // undefined for standalone/home-level tasks not inside any project
  folderId?: string // set when this task is filed inside a folder (hidden from its column while filed)
  // Status. While folderId is set, this is display-only (shown as a pill on the
  // card) — the task lives in the folder's taskIds, not in this column's cardOrder.
  columnId: string
  title: string
  summary?: string
  priority?: Priority
  dueDate?: string // ISO date string (yyyy-MM-dd)
  tagIds: string[]
  links: ResourceLink[]
  attachments: AttachmentMeta[]
  checklist: ChecklistItem[]
  createdAt: number
  updatedAt: number
}

export interface Column {
  id: string
  ownerType: ColumnOwnerType
  ownerId?: string // undefined only when ownerType === 'home' (singleton, no owning row)
  name: string
  color: string
  cardOrder: string[] // ids of items placed here: Project | Folder | Card ids, depending on ownerType
}

// Tags are a single global pool, not scoped to a project — usable by any task
// regardless of whether it belongs to a project, a folder, or neither.
export interface Tag {
  id: string
  name: string
  color: string
}

export interface Project {
  id: string
  name: string
  description?: string
  links: ResourceLink[]
  attachments: AttachmentMeta[]
  createdAt: number
  updatedAt: number
  columnOrder: string[] // this project's own board's 4 column ids
  columnId: string // which Home-board column this project currently sits in
}

export interface Folder {
  id: string
  ownerType: 'home' | 'project' // where the folder itself lives as a card
  ownerId?: string // project id if ownerType === 'project'; undefined if 'home'
  name: string
  color: string
  description?: string
  columnId: string // which column of the owner board this folder sits in
  taskIds: string[] // ordered ids of tasks filed into this folder (flat list, no sub-status)
  createdAt: number
  updatedAt: number
}

export type BoardItem =
  | { kind: 'project'; project: Project }
  | { kind: 'folder'; folder: Folder }
  | { kind: 'task'; card: Card }
