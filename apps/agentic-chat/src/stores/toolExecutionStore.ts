import { produce, enableMapSet } from 'immer'
import { create } from 'zustand'

// Enable Immer support for Map and Set
enableMapSet()

const STORE_VERSION = 1

export interface PersistedToolState {
  toolCallId: string
  phases: string[]
  meta: Record<string, unknown>
}

export interface SerializedStoreState {
  _v: number
  states: PersistedToolState[]
}

interface ToolExecutionState {
  executedIds: Set<string>
  historicalToolIds: Set<string>
  toolStates: Map<string, unknown>
  persistedStates: Map<string, PersistedToolState>

  markExecuted: (toolCallId: string) => void
  markMultipleExecuted: (toolCallIds: string[]) => void
  hasExecuted: (toolCallId: string) => boolean
  markAsHistorical: (toolCallIds: string[]) => void
  isHistorical: (toolCallId: string) => boolean
  clearHistoricalTools: () => void
  initializeState: <T>(toolCallId: string, initialState: T) => void
  getState: <T>(toolCallId: string, initialState: T) => T
  setState: <T>(toolCallId: string, updater: (draft: T) => void) => void
  savePersistedState: (state: PersistedToolState) => void
  getPersistedState: (toolCallId: string) => PersistedToolState | undefined
  serializePersistedStates: () => SerializedStoreState
  restorePersistedStates: (serialized: SerializedStoreState) => void
}

export const useToolExecutionStore = create<ToolExecutionState>((set, get) => ({
  executedIds: new Set(),
  historicalToolIds: new Set(),
  toolStates: new Map(),
  persistedStates: new Map(),

  markExecuted: (toolCallId: string) => {
    set(state => ({
      executedIds: new Set(state.executedIds).add(toolCallId),
    }))
  },

  markMultipleExecuted: (toolCallIds: string[]) => {
    set(state => {
      const newExecutedIds = new Set(state.executedIds)
      toolCallIds.forEach(id => newExecutedIds.add(id))
      return { executedIds: newExecutedIds }
    })
  },

  hasExecuted: (toolCallId: string) => {
    return get().executedIds.has(toolCallId)
  },

  markAsHistorical: (toolCallIds: string[]) => {
    set(state => {
      const newHistoricalToolIds = new Set(state.historicalToolIds)
      toolCallIds.forEach(id => newHistoricalToolIds.add(id))
      return { historicalToolIds: newHistoricalToolIds }
    })
  },

  isHistorical: (toolCallId: string) => {
    return get().historicalToolIds.has(toolCallId)
  },

  clearHistoricalTools: () => {
    set({ historicalToolIds: new Set() })
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

  savePersistedState: (state: PersistedToolState) => {
    set(storeState => ({
      persistedStates: new Map(storeState.persistedStates).set(state.toolCallId, state),
    }))
  },

  getPersistedState: (toolCallId: string) => {
    return get().persistedStates.get(toolCallId)
  },

  serializePersistedStates: () => {
    const persistedStates = get().persistedStates
    const states: PersistedToolState[] = Array.from(persistedStates.values())

    return {
      _v: STORE_VERSION,
      states,
    }
  },

  restorePersistedStates: (serialized: SerializedStoreState) => {
    try {
      const restoredStates = new Map<string, PersistedToolState>()

      serialized.states?.forEach(state => {
        restoredStates.set(state.toolCallId, state)
      })

      set({ persistedStates: restoredStates })
    } catch (error) {
      console.error('[toolExecutionStore] Failed to restore persisted states:', error)
    }
  },
}))
