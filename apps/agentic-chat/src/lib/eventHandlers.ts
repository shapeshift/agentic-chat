import type { MouseEvent } from 'react'

// Prevents click events from propagating to parent elements
export const stopPropagationHandler = (e: MouseEvent) => {
  e.stopPropagation()
}
