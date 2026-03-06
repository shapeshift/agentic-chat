import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(duration)
dayjs.extend(relativeTime)

export function formatDuration(seconds: number): string {
  return dayjs.duration(seconds, 'seconds').humanize()
}

export function formatFrequency(intervalSeconds: number): string {
  if (intervalSeconds <= 60) return 'Every minute'
  if (intervalSeconds < 3600) return `Every ${Math.round(intervalSeconds / 60)} minutes`
  if (intervalSeconds === 3600) return 'Every hour'
  if (intervalSeconds < 86400) return `Every ${Math.round(intervalSeconds / 3600)} hours`
  if (intervalSeconds === 86400) return 'Daily'
  return `Every ${dayjs.duration(intervalSeconds, 'seconds').humanize()}`
}
