import { isDueThisWeek, isDueToday, isOverdue } from './dates'
import type { Priority } from '../types'

export type DateFilter = 'overdue' | 'today' | 'week' | 'none'

export const DATE_FILTERS: DateFilter[] = ['overdue', 'today', 'week', 'none']
export const DATE_FILTER_LABEL: Record<DateFilter, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  week: 'Due this week',
  none: 'No due date',
}

// All facets below are sets, not single picks: an item passes a facet if it
// matches ANY selected value in that facet (or the facet is empty, meaning
// "don't filter on this"). Facets are ANDed together.
export function matchesPriorityFilter(priority: Priority | undefined, filter: Priority[]): boolean {
  return filter.length === 0 || (priority !== undefined && filter.includes(priority))
}

export function matchesStatusFilter(columnId: string, filter: string[]): boolean {
  return filter.length === 0 || filter.includes(columnId)
}

export function matchesDateFilter(dueDate: string | undefined, filter: DateFilter[]): boolean {
  if (filter.length === 0) return true
  return filter.some((f) => {
    switch (f) {
      case 'overdue':
        return dueDate ? isOverdue(dueDate) : false
      case 'today':
        return dueDate ? isDueToday(dueDate) : false
      case 'week':
        return dueDate ? isDueThisWeek(dueDate) : false
      case 'none':
        return !dueDate
    }
  })
}
