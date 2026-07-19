import { addDays, endOfDay, format, isPast, isToday, isWithinInterval, parseISO, startOfDay } from 'date-fns'

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

export function isDueThisWeek(iso: string): boolean {
  const date = parseISO(iso)
  const now = new Date()
  return isWithinInterval(date, { start: startOfDay(now), end: endOfDay(addDays(now, 6)) })
}
