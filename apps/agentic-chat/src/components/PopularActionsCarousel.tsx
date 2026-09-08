import { useCallback, useEffect, useRef, useState } from 'react'

import { useMediaQuery } from '@/hooks/useMediaQuery'

import { Button } from './ui/Button'

type PopularActionsCarouselProps = {
  actions: string[]
  onActionClick: (action: string) => void
}

const AUTO_ADVANCE_MS = 5000

export function PopularActionsCarousel({ actions, onActionClick }: PopularActionsCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activePage, setActivePage] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isTouching, setIsTouching] = useState(false)
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDesktop = useMediaQuery('(min-width: 640px)')
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const pageSize = isDesktop ? 2 : 1
  const pageCount = Math.ceil(actions.length / pageSize)
  const pages = Array.from({ length: pageCount }, (_, page) => actions.slice(page * pageSize, (page + 1) * pageSize))
  const isPaused = isHovered || isFocused || isTouching || reducedMotion

  const stopResumeTimer = useCallback(() => {
    if (pauseTimeoutRef.current === null) return
    clearTimeout(pauseTimeoutRef.current)
    pauseTimeoutRef.current = null
  }, [])

  const resumeAfterInteraction = useCallback(() => {
    stopResumeTimer()
    pauseTimeoutRef.current = setTimeout(() => {
      setIsTouching(false)
      pauseTimeoutRef.current = null
    }, 1200)
  }, [stopResumeTimer])

  const goToPage = useCallback(
    (page: number) => {
      const container = containerRef.current
      if (!container) return
      container.scrollTo({
        left: page * container.clientWidth,
        behavior: reducedMotion ? 'instant' : 'smooth',
      })
    },
    [reducedMotion]
  )

  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container || !container.clientWidth) return
    setActivePage(Math.min(Math.max(0, pageCount - 1), Math.round(container.scrollLeft / container.clientWidth)))
  }, [pageCount])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    // Page grouping changes at the breakpoint. Reset to a valid snap position.
    container.scrollTo({ left: 0, behavior: 'instant' })
    setActivePage(0)
    const observer = new ResizeObserver(handleScroll)
    observer.observe(container)
    return () => observer.disconnect()
  }, [pageSize, handleScroll])

  useEffect(() => {
    if (pageCount <= 1 || isPaused) return
    const timer = setInterval(() => goToPage((activePage + 1) % pageCount), AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [pageCount, activePage, goToPage, isPaused])

  useEffect(() => stopResumeTimer, [stopResumeTimer])

  if (!pageCount) return null

  return (
    <div
      className="bg-background/80 backdrop-blur-md border-t border-border"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false)
      }}
    >
      <div className="mx-auto max-w-2xl px-4 pt-3">
        <div
          ref={containerRef}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={handleScroll}
          onTouchStart={() => {
            stopResumeTimer()
            setIsTouching(true)
          }}
          onTouchEnd={resumeAfterInteraction}
          onTouchCancel={resumeAfterInteraction}
          role="region"
          aria-roledescription="carousel"
          aria-label="Popular actions"
        >
          {pages.map((page, index) => (
            <div
              key={index}
              className={`grid w-full shrink-0 snap-start gap-2 ${isDesktop ? 'grid-cols-2' : 'grid-cols-1'}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${pageCount}`}
            >
              {page.map(action => (
                <Button
                  key={action}
                  onClick={() => onActionClick(action)}
                  title={action}
                  variant="outline"
                  className="h-[52px] min-w-0 whitespace-normal text-left leading-tight"
                >
                  {action}
                </Button>
              ))}
            </div>
          ))}
        </div>
        {pageCount > 1 && (
          <div className="flex justify-center">
            {pages.map((page, index) => (
              <button
                key={index}
                type="button"
                onClick={() => goToPage(index)}
                aria-label={`Show actions page ${index + 1}`}
                aria-current={index === activePage ? 'page' : undefined}
                title={page.join(' / ')}
                className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={`h-2 rounded-full transition-all ${index === activePage ? 'w-5 bg-foreground' : 'w-2 bg-muted-foreground/40'}`}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
