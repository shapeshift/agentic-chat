import type { DependencyList } from 'react'
import { useEffect } from 'react'

import { useChatStore } from '@/stores/chatStore'

interface UseToolExecutionEffectResult<TState> {
  state: TState
  setState: (updater: (draft: TState) => void) => void
}

export function useToolExecutionEffect<TData, TState>(
  toolCallId: string,
  data: TData | null,
  initialState: TState,
  execute: (data: TData, setState: (updater: (draft: TState) => void) => void) => void | Promise<void>,
  deps: DependencyList
): UseToolExecutionEffectResult<TState> {
  const { setRuntimeState, hasRuntimeState, initializeRuntimeState } = useChatStore()

  const state = useChatStore(store => {
    const toolState = store.runtimeToolStates.get(toolCallId)
    return toolState !== undefined ? (toolState as TState) : initialState
  })

  const wrappedSetState = (updater: (draft: TState) => void) => {
    setRuntimeState(toolCallId, updater)
  }

  useEffect(() => {
    if (!data) {
      return
    }

    if (hasRuntimeState(toolCallId)) {
      return
    }

    initializeRuntimeState(toolCallId, initialState)

    const executeWrapper = async () => {
      await execute(data, wrappedSetState)
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    executeWrapper()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolCallId, data, state, hasRuntimeState, setRuntimeState, initializeRuntimeState, ...deps])

  return {
    state,
    setState: wrappedSetState,
  }
}
