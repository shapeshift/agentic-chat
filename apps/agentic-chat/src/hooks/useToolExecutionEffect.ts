import type { DependencyList } from 'react'
import { useEffect } from 'react'

import { useToolExecutionStore } from '@/stores/toolExecutionStore'

interface UseToolExecutionEffectResult<TState> {
  state: TState
  setState: (updater: (draft: TState) => void) => void
}

export function useToolExecutionEffect<TData, TState>(
  toolCallId: string,
  data: TData | null,
  initialState: TState,
  shouldExecute: (data: TData, state: TState) => boolean,
  execute: (data: TData, setState: (updater: (draft: TState) => void) => void) => void | Promise<void>,
  deps: DependencyList
): UseToolExecutionEffectResult<TState> {
  const { setState, hasExecuted, markExecuted, initializeState } = useToolExecutionStore()

  // Use a selector to reactively subscribe to this tool's state
  const state = useToolExecutionStore(store => {
    const toolState = store.toolStates.get(toolCallId)
    return toolState !== undefined ? (toolState as TState) : initialState
  })

  const wrappedSetState = (updater: (draft: TState) => void) => {
    setState(toolCallId, updater)
  }

  useEffect(() => {
    if (!data) {
      return
    }

    // Early exit if already executed - skip all initialization work
    if (hasExecuted(toolCallId)) {
      return
    }

    // Initialize state in store if this is the first time
    initializeState(toolCallId, initialState)

    // Use the reactive state
    if (!shouldExecute(data, state)) {
      return
    }

    markExecuted(toolCallId)

    const executeWrapper = async () => {
      await execute(data, wrappedSetState)
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    executeWrapper()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolCallId, data, state, hasExecuted, markExecuted, setState, initializeState, ...deps])

  return {
    state,
    setState: wrappedSetState,
  }
}
