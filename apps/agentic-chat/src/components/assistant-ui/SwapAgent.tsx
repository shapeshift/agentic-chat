import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { SwapWorkflowInput, SwapWorkflowResult } from '@shapeshiftoss/agentic-server'

import { TextComplete } from '@/components/TextComplete'
import { TextShimmer } from '@/components/TextShimmer'

type SwapAgentContentProps = Omit<ToolCallMessagePartProps<SwapWorkflowInput, SwapWorkflowResult>, 'args'> & {
  args: Partial<SwapWorkflowInput>
}

const SwapAgentContent: React.FC<SwapAgentContentProps> = ({ args, result, status, isError }) => {
  switch (status.type) {
    case 'running': {
      const sellAsset = args.sellAsset?.symbol || 'unknown'
      const buyAsset = args.buyAsset?.symbol || 'unknown'
      const amount = args.sellAmountCryptoPrecision || 'unknown'
      return <TextShimmer>{`Swapping ${amount} ${sellAsset} to ${buyAsset}`}</TextShimmer>
    }
    case 'complete': {
      if (isError || !result || ('code' in result && result.code === 'TOOL_EXECUTION_FAILED')) {
        return <TextComplete>{`Failed to perform swap ❌`}</TextComplete>
      }

      return <TextComplete>{`Swap completed ✅`}</TextComplete>
    }
  }
}

export const SwapAgent = makeAssistantToolUI<SwapWorkflowInput, SwapWorkflowResult>({
  toolName: 'swapWorkflow',
  render: SwapAgentContent,
})
