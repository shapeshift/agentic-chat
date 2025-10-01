import { produce, enableMapSet } from 'immer'
import { create } from 'zustand'

// Enable Immer support for Map and Set
enableMapSet()

interface ToolExecutionState {
  executedIds: Set<string>
  toolStates: Map<string, unknown>

  markExecuted: (toolCallId: string) => void
  hasExecuted: (toolCallId: string) => boolean
  initializeState: <T>(toolCallId: string, initialState: T) => void
  getState: <T>(toolCallId: string, initialState: T) => T
  setState: <T>(toolCallId: string, updater: (draft: T) => void) => void
}

export const useToolExecutionStore = create<ToolExecutionState>((set, get) => ({
  executedIds: new Set(),
  toolStates: new Map(),

  markExecuted: (toolCallId: string) => {
    set(state => ({
      executedIds: new Set(state.executedIds).add(toolCallId),
    }))
  },

  hasExecuted: (toolCallId: string) => {
    return get().executedIds.has(toolCallId)
  },

  initializeState: <T>(toolCallId: string, initialState: T) => {
    const currentStates = get().toolStates
    if (!currentStates.has(toolCallId)) {
      const newStates = new Map(currentStates)
      newStates.set(toolCallId, initialState)
      set({ toolStates: newStates })
    }
  },

  getState: <T>(toolCallId: string, initialState: T): T => {
    const state = get().toolStates.get(toolCallId)
    return state !== undefined ? (state as T) : initialState
  },

  setState: <T>(toolCallId: string, updater: (draft: T) => void) => {
    const currentStates = get().toolStates
    const currentState = currentStates.get(toolCallId) as T | undefined

    if (currentState === undefined) {
      console.error(`[toolExecutionStore] Attempted to update uninitialized state for toolCallId: ${toolCallId}`)
      return
    }

    // Use Immer to update the state object, then put back in Map
    const updatedState = produce(currentState, updater)
    const newStates = new Map(currentStates)
    newStates.set(toolCallId, updatedState)
    set({ toolStates: newStates })
  },
}))
