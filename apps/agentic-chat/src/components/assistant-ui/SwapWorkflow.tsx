import type { ToolCallMessagePartProps, ToolCallMessagePart } from '@assistant-ui/react'
import { makeAssistantToolUI, useAssistantRuntime } from '@assistant-ui/react'
import { MastraClient } from '@mastra/client-js'
import type { SwapWorkflowInput, SwapWorkflowResult } from '@shapeshiftoss/agentic-server'
import { Wallet } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useWalletClient } from 'wagmi'

import { Button } from '@/components/ui/button'
import { sendTransaction } from '@/utils/sendTransaction'

import { CollapsableDetails } from './CollapsableDetails'

const mastraClient = new MastraClient({
  baseUrl: 'http://localhost:4111',
})

const Icon = Wallet

type SwapWorkflowContentProps = Omit<ToolCallMessagePartProps<SwapWorkflowInput, SwapWorkflowResult>, 'args'> & {
  args: Partial<SwapWorkflowInput>
}

const SwapWorkflowContent: React.FC<SwapWorkflowContentProps> = ctx => {
  const { data: walletClient } = useWalletClient()
  const [hasApproved, setHasApproved] = useState(false)
  const [hasSwapped, setHasSwapped] = useState(false)
  const { thread } = useAssistantRuntime()

  useEffect(() => {
    console.log({ ctx })
  }, [ctx])

  const { status, result, isError, toolName } = useMemo(() => ctx, [ctx])

  const approveStep = useMemo(() => result?.steps?.approve, [result])
  const swapStep = useMemo(() => result?.steps?.swap, [result])

  const approve = useCallback(async () => {
    if (hasApproved) return
    if (!walletClient) return
    if (!approveStep?.suspendPayload) return

    const { runId, ...unsignedTx } = approveStep.suspendPayload

    try {
      const workflow = mastraClient.getWorkflow(toolName)

      const txHash = await sendTransaction({ ...unsignedTx, walletClient })

      setHasApproved(true)

      const result = await workflow.resumeAsync({ runId, step: 'approve', resumeData: { txHash } })

      const message: ToolCallMessagePart = { ...ctx, result }
      thread.append({ role: 'assistant', content: [message] })
    } catch (err) {
      console.error('Failed to approve:', err)
    }
  }, [approveStep, ctx, hasApproved, setHasApproved, thread, toolName, walletClient])

  const swap = useCallback(async () => {
    if (hasSwapped) return
    if (!walletClient) return
    if (!swapStep?.suspendPayload) return

    const { runId, ...unsignedTx } = swapStep.suspendPayload

    try {
      const workflow = mastraClient.getWorkflow(toolName)

      const txHash = await sendTransaction({ ...unsignedTx, walletClient })

      setHasSwapped(true)

      const result = await workflow.resumeAsync({ runId, step: 'swap', resumeData: { txHash } })

      const message: ToolCallMessagePart = { ...ctx, result }
      thread.append({ role: 'assistant', content: [message] })
    } catch (err) {
      console.error('Failed to swap:', err)
    }
  }, [ctx, hasSwapped, setHasSwapped, swapStep, thread, toolName, walletClient])

  switch (status.type) {
    case 'complete': {
      if (isError || !result || result.status === 'failed') {
        return (
          <CollapsableDetails
            title={`An error occurred with ${toolName}`}
            leftIcon={<Icon className="w-4 h-4 text-red-500" />}
          >
            {JSON.stringify(result || 'Failed to fetch quote')}
          </CollapsableDetails>
        )
      }

      switch (result.status) {
        case 'suspended': {
          if (result.suspended.flat().includes('approve')) {
            return (
              <Button disabled={hasApproved} onClick={() => void approve()}>
                Approve
              </Button>
            )
          }

          if (result.suspended.flat().includes('swap')) {
            return (
              <Button disabled={hasSwapped} onClick={() => void swap()}>
                Swap
              </Button>
            )
          }

          return (
            <CollapsableDetails title="Swap Details" leftIcon={<Icon className="w-4 h-4 text-green-500" />}>
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </CollapsableDetails>
          )
        }
        case 'success': {
          return (
            <CollapsableDetails title="Swap Details" leftIcon={<Icon className="w-4 h-4 text-green-500" />}>
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </CollapsableDetails>
          )
        }
      }
    }
  }
}

export const SwapWorkflow = makeAssistantToolUI<SwapWorkflowInput, SwapWorkflowResult>({
  toolName: 'swapWorkflowTool',
  render: SwapWorkflowContent,
})
