export type Priority = 'low' | 'med' | 'high'

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
  projectId: string
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
  projectId: string
  name: string
  color: string
  cardOrder: string[]
}

export interface Tag {
  id: string
  projectId: string
  name: string
  color: string
}

export interface Project {
  id: string
  name: string
  description?: string
  createdAt: number
  updatedAt: number
  columnOrder: string[]
}
