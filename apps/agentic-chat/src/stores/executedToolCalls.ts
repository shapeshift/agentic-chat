import { create } from 'zustand'

interface ExecutedToolCallsState {
  executedIds: Set<string>
  markExecuted: (toolCallId: string) => void
  hasExecuted: (toolCallId: string) => boolean
}

export const useExecutedToolCalls = create<ExecutedToolCallsState>((set, get) => ({
  executedIds: new Set(),

  markExecuted: (toolCallId: string) => {
    set(state => ({
      executedIds: new Set(state.executedIds).add(toolCallId),
    }))
  },

  hasExecuted: (toolCallId: string) => {
    return get().executedIds.has(toolCallId)
  },
}))
