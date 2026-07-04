import { format, isPast, isToday, parseISO } from 'date-fns'

export function formatDueDate(iso: string): string {
  return format(parseISO(iso), 'MMM d, yyyy')
}

export function isOverdue(iso: string): boolean {
  const date = parseISO(iso)
  return isPast(date) && !isToday(date)
}

export function isDueToday(iso: string): boolean {
  return isToday(parseISO(iso))
}
