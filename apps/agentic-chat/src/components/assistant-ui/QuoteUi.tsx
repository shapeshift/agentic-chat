import type { ToolCallContentPartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import { MastraClient } from '@mastra/client-js'
import type { SwapWorkflowInput, SwapWorkflowResult } from '@shapeshiftoss/mastra'
import axios from 'axios'
import { Wallet } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useWalletClient } from 'wagmi'

import { TextShimmer } from '../TextShimmer'
import { Button } from '../ui/button'

import { CollapsableDetails } from './CollapsableDetails'

//const mastraClient = new MastraClient({
//  baseUrl: 'http://localhost:8080',
//})

const Icon = Wallet

type SwapWorkflowUiContentProps = ToolCallContentPartProps<SwapWorkflowInput, SwapWorkflowResult>

const SwapWorkflowUiContent: React.FC<SwapWorkflowUiContentProps> = ({ status, result, args, isError, toolName }) => {
  const { data: walletClient } = useWalletClient()
  const [hasResumedApprove, setHasResumedApprove] = useState(false)

  console.log({ status, result, args, isError, toolName, walletClient })

  const resumeApprove = useCallback(
    async (runId: string) => {
      //if (hasResumedApprove) return
      try {
        //const workflow = mastraClient.getWorkflow('swapWorkflow')
        //console.log({ workflow })
        await axios.post(import.meta.env.VITE_AGENTIC_SERVER_BASE_URL as string, {
          userContext: {
            address: walletClient?.account.address,
          },
          messages: JSON.stringify({
            role: 'user',
            resume: {
              workflow: toolName,
              step: ['approve'],
              resumePayload: '0x0000',
              runId,
            },
          }),
        })
      } catch (err) {
        console.error(err)
      } finally {
        setHasResumedApprove(true)
      }
    },
    [hasResumedApprove, setHasResumedApprove, toolName, walletClient]
  )

  switch (status.type) {
    case 'running':
    case 'requires-action':
    case 'incomplete': {
      return <TextShimmer>Getting quote for {JSON.stringify(args)}...</TextShimmer>
    }
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
          const approveStep = result.steps['approve']

          if (approveStep.suspendPayload) {
            return <Button onClick={() => void resumeApprove(approveStep.suspendPayload!.runId)}>Approve</Button>
          }

          return (
            <CollapsableDetails title="Quote Details" leftIcon={<Icon className="w-4 h-4 text-green-500" />}>
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </CollapsableDetails>
          )
        }
        case 'success': {
          return (
            <CollapsableDetails title="Quote Details" leftIcon={<Icon className="w-4 h-4 text-green-500" />}>
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </CollapsableDetails>
          )
        }
      }
    }
  }
}

const SwapWorkflowUi = makeAssistantToolUI<SwapWorkflowInput, SwapWorkflowResult>({
  toolName: 'swapWorkflow',
  render: SwapWorkflowUiContent,
})

export default SwapWorkflowUi
