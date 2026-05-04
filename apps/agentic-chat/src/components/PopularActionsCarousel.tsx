import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from './ui/Button'

type PopularActionsCarouselProps = {
  actions: string[]
  onActionClick: (action: string) => void
}

const AUTO_ADVANCE_MS = 5000

export function PopularActionsCarousel({ actions, onActionClick }: PopularActionsCarouselProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)

  const stopResumeTimer = useCallback(() => {
    if (!pauseTimeoutRef.current) return
    clearTimeout(pauseTimeoutRef.current)
    pauseTimeoutRef.current = null
  }, [])

  const resumeAfterInteraction = useCallback(() => {
    stopResumeTimer()
    pauseTimeoutRef.current = setTimeout(() => {
      setIsPaused(false)
      pauseTimeoutRef.current = null
    }, 1200)
  }, [stopResumeTimer])

  const goToSlide = useCallback((index: number) => {
    const container = containerRef.current
    if (!container) return
    const item = container.querySelector<HTMLButtonElement>(`[data-action-index="${index}"]`)
    if (!item) return
    item.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
    setActiveIndex(index)
  }, [])

  const handleScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    rafRef.current = requestAnimationFrame(() => {
      const container = containerRef.current
      if (!container) return

      const children = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-action-index]'))
      if (children.length === 0) return

      let closestIndex = 0
      let closestDistance = Number.POSITIVE_INFINITY

      children.forEach((child, index) => {
        const distance = Math.abs(child.offsetLeft - container.scrollLeft)
        if (distance < closestDistance) {
          closestDistance = distance
          closestIndex = index
        }
      })

      setActiveIndex(closestIndex)
    })
  }, [])

  useEffect(() => {
    if (actions.length <= 1 || isPaused) return

    const timer = setInterval(() => {
      const nextIndex = (activeIndex + 1) % actions.length
      goToSlide(nextIndex)
    }, AUTO_ADVANCE_MS)

    return () => clearInterval(timer)
  }, [actions.length, activeIndex, goToSlide, isPaused])

  useEffect(() => {
    return () => {
      stopResumeTimer()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [stopResumeTimer])

  return (
    <div
      className="bg-background/80 backdrop-blur-md border-t border-border"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      <div className="mx-auto max-w-2xl px-4 py-3">
        <div
          ref={containerRef}
          className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={handleScroll}
          onTouchStart={() => {
            stopResumeTimer()
            setIsPaused(true)
          }}
          onTouchEnd={resumeAfterInteraction}
          onTouchCancel={resumeAfterInteraction}
          role="region"
          aria-label="Popular actions"
        >
          {actions.map((action, index) => (
            <Button
              key={action}
              data-action-index={index}
              onClick={() => onActionClick(action)}
              title={action}
              variant="outline"
              className="h-[52px] w-[85%] shrink-0 snap-start whitespace-normal text-left leading-tight sm:w-[calc(50%-0.25rem)]"
            >
              {action}
            </Button>
          ))}
        </div>
        <div className="mt-2 flex justify-center gap-1.5">
          {actions.map((action, index) => (
            <button
              key={`dot-${action}`}
              type="button"
              onClick={() => goToSlide(index)}
              aria-label={`Show action ${index + 1}`}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${index === activeIndex ? 'bg-foreground' : 'bg-muted-foreground/30'}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
