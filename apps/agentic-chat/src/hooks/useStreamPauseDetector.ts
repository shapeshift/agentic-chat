import { useEffect, useRef, useState } from 'react'

export function useStreamPauseDetector(
  isLoading: boolean,
  lastMessageContent: string | undefined,
  pauseThresholdMs = 500
): boolean {
  const [isPaused, setIsPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevContentRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!isLoading) {
      setIsPaused(false)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      prevContentRef.current = undefined
      return
    }

    const contentChanged = lastMessageContent !== prevContentRef.current
    prevContentRef.current = lastMessageContent

    if (contentChanged) {
      setIsPaused(false)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }

    timerRef.current = setTimeout(() => {
      setIsPaused(true)
    }, pauseThresholdMs)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [isLoading, lastMessageContent, pauseThresholdMs])

  return isPaused
}
