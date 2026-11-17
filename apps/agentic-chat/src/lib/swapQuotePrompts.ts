import { QUOTE_SIGNING_BUFFER_MS } from '@/utils/prepareFreshSwap'

// Updated-quote prompts are keyed by tool call, outside React, so a swap card that the
// virtualized chat list unmounts and remounts picks the pending prompt back up.

interface PendingPrompt {
  resolve: (accepted: boolean) => void
  reject: (error: Error) => void
  expiresAt?: number
  timer?: ReturnType<typeof setTimeout>
}

const mountedViews = new Map<string, number>()
const prompts = new Map<string, PendingPrompt>()
const listeners = new Set<() => void>()

export const UNREVIEWED_QUOTE_ERROR = 'Updated swap quote expired before it was reviewed. Please start the swap again.'

function notify() {
  for (const listener of listeners) listener()
}

function settle(toolCallId: string): PendingPrompt | undefined {
  const prompt = prompts.get(toolCallId)
  if (!prompt) return undefined
  clearTimeout(prompt.timer)
  prompts.delete(toolCallId)
  notify()
  return prompt
}

// With no card on screen, nobody can review the terms. Wait for a remount only while the
// quote could still be signed, so an unseen prompt never holds the wallet lock indefinitely.
function scheduleUnreviewedCancel(toolCallId: string, prompt: PendingPrompt) {
  clearTimeout(prompt.timer)
  prompt.timer = undefined
  if (mountedViews.get(toolCallId)) return
  const delay = Math.max(0, (prompt.expiresAt ?? 0) - QUOTE_SIGNING_BUFFER_MS - Date.now())
  prompt.timer = setTimeout(() => settle(toolCallId)?.reject(new Error(UNREVIEWED_QUOTE_ERROR)), delay)
}

export function mountQuoteView(toolCallId: string): () => void {
  mountedViews.set(toolCallId, (mountedViews.get(toolCallId) ?? 0) + 1)
  const pending = prompts.get(toolCallId)
  if (pending) scheduleUnreviewedCancel(toolCallId, pending)
  return () => {
    const count = (mountedViews.get(toolCallId) ?? 1) - 1
    if (count > 0) mountedViews.set(toolCallId, count)
    else mountedViews.delete(toolCallId)
    const prompt = prompts.get(toolCallId)
    if (prompt) scheduleUnreviewedCancel(toolCallId, prompt)
  }
}

export function requestQuoteAcceptance(toolCallId: string, expiresAt?: number): Promise<boolean> {
  settle(toolCallId)?.resolve(false)
  return new Promise<boolean>((resolve, reject) => {
    const prompt: PendingPrompt = { resolve, reject, expiresAt }
    prompts.set(toolCallId, prompt)
    scheduleUnreviewedCancel(toolCallId, prompt)
    notify()
  })
}

export function answerQuotePrompt(toolCallId: string, accepted: boolean): void {
  settle(toolCallId)?.resolve(accepted)
}

export function isAwaitingQuoteAcceptance(toolCallId: string): boolean {
  return prompts.has(toolCallId)
}

export function subscribeQuotePrompts(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
