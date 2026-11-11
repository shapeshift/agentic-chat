import { useEffect, useRef } from 'react'

import { useChatStore } from '@/stores/chatStore'

import type { ExecutionContext } from './useToolExecution'

// A tool call loaded from a saved conversation must never start executing: an in-flight swap
// is not persisted until it finishes, so reopening it would otherwise sign it again.
export function shouldExecuteTool(guards: { persisted: boolean; running: boolean; historical: boolean }): boolean {
  return !guards.persisted && !guards.running && !guards.historical
}

export function useExecuteOnce<TMeta extends object, TData>(
  ctx: ExecutionContext<TMeta>,
  data: TData | null,
  executor: (data: TData, ctx: ExecutionContext<TMeta>) => Promise<void>
): void {
  const { hasRuntimeState, initializeRuntimeState, isHistorical } = useChatStore()

  const persistedTransaction = useChatStore(store => store.getPersistedTransaction(ctx.toolCallId))

  const executorRef = useRef(executor)
  const ctxRef = useRef(ctx)
  executorRef.current = executor
  ctxRef.current = ctx

  useEffect(() => {
    if (
      !data ||
      !shouldExecuteTool({
        persisted: !!persistedTransaction,
        running: hasRuntimeState(ctx.toolCallId),
        historical: isHistorical(ctx.toolCallId),
      })
    )
      return

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
