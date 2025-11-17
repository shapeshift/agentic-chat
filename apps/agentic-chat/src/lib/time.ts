import { differenceInDays, differenceInHours, differenceInMinutes, format, fromUnixTime } from 'date-fns'

export function formatTimestamp(timestamp: number): string {
  return format(fromUnixTime(timestamp), 'MMMM d, yyyy')
}

export function formatShortTimestamp(timestamp: number): string {
  const date = fromUnixTime(timestamp)
  const now = new Date()
  const diffMins = differenceInMinutes(now, date)
  const diffHours = differenceInHours(now, date)
  const diffDays = differenceInDays(now, date)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`

  return format(date, 'MMM d')
}
