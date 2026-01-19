import { useEffect, useRef } from 'react'

import { useChatStore } from '../store/chatStore'

interface UseToolExecutionEffectResult<TState> {
  state: TState
  setState: (updater: (draft: TState) => void) => void
}

export function useToolExecutionEffect<TData, TState>(
  toolCallId: string,
  data: TData | null,
  initialState: TState,
  execute: (data: TData, setState: (updater: (draft: TState) => void) => void) => void | Promise<void>
): UseToolExecutionEffectResult<TState> {
  const { setRuntimeState, hasRuntimeState, initializeRuntimeState } = useChatStore()

  const state = useChatStore(store => {
    const toolState = store.runtimeToolStates.get(toolCallId)
    return toolState !== undefined ? (toolState as TState) : initialState
  })

  const wrappedSetState = (updater: (draft: TState) => void) => {
    setRuntimeState(toolCallId, updater)
  }

  // Refs to always access latest callbacks (avoids stale closures)
  const executeRef = useRef(execute)
  const setStateRef = useRef(wrappedSetState)
  executeRef.current = execute
  setStateRef.current = wrappedSetState

  useEffect(() => {
    if (!data) {
      return
    }

    if (hasRuntimeState(toolCallId)) {
      return
    }

    initializeRuntimeState(toolCallId, initialState)

    const executeWrapper = async () => {
      try {
        await executeRef.current(data, setStateRef.current)
      } catch (error) {
        console.error('[useToolExecutionEffect] Tool execution failed:', error)
      }
    }

    void executeWrapper()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolCallId, data])

  return {
    state,
    setState: wrappedSetState,
  }
}
