import { useEffect, useRef } from 'react'

import { useChatStore } from '@/stores/chatStore'

import type { ExecutionContext } from './useToolExecution'

export function useExecuteOnce<TMeta extends object, TData>(
  ctx: ExecutionContext<TMeta>,
  data: TData | null,
  executor: (data: TData, ctx: ExecutionContext<TMeta>) => Promise<void>
): void {
  const { hasRuntimeState, initializeRuntimeState } = useChatStore()

  const persistedTransaction = useChatStore(store => store.getPersistedTransaction(ctx.toolCallId))

  const executorRef = useRef(executor)
  const ctxRef = useRef(ctx)
  executorRef.current = executor
  ctxRef.current = ctx

  useEffect(() => {
    // Guard 1: Already persisted — skip execution
    if (persistedTransaction) return

    // Guard 2: No data yet — skip execution
    if (!data) return

    // Guard 3: Already running — skip execution
    if (hasRuntimeState(ctx.toolCallId)) return

    initializeRuntimeState(ctx.toolCallId, ctx.state)

    const run = async () => {
      try {
        await executorRef.current(data, ctxRef.current)
      } catch (error) {
        console.error('[useExecuteOnce] Unhandled executor error:', error)
      }
    }

    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.toolCallId, data, persistedTransaction])
}
