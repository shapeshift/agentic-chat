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
  const { getState, setState, hasExecuted, markExecuted, initializeState } = useToolExecutionStore()
  const state = getState(toolCallId, initialState)

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

    // Get fresh state after initialization
    const currentState = getState(toolCallId, initialState)

    if (!shouldExecute(data, currentState)) {
      return
    }

    markExecuted(toolCallId)

    const executeWrapper = async () => {
      await execute(data, wrappedSetState)
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    executeWrapper()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolCallId, data, hasExecuted, markExecuted, getState, setState, initializeState, ...deps])

  return {
    state,
    setState: wrappedSetState,
  }
}
