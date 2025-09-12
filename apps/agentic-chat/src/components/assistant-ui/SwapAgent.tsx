import type { ToolCallContentPartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { SwapAgentInput, SwapAgentOutput } from '@shapeshiftoss/agentic-server'

import { TextComplete } from '@/components/TextComplete'
import { TextShimmer } from '@/components/TextShimmer'

type SwapAgentContentProps = Omit<ToolCallContentPartProps<SwapAgentInput, SwapAgentOutput>, 'args'> & {
  args: Partial<SwapAgentInput>
}

const SwapAgentContent: React.FC<SwapAgentContentProps> = ({ args, result, status, isError }) => {
  switch (status.type) {
    case 'running': {
      if (!args.prompt) return null
      return <TextShimmer>{args.prompt}</TextShimmer>
    }
    case 'complete': {
      if (isError || !result || ('code' in result && result.code === 'TOOL_EXECUTION_FAILED')) {
        return <TextComplete>{`Failed to perform swap ❌`}</TextComplete>
      }

      return <TextComplete>{`Swap completed ✅`}</TextComplete>
    }
  }
}

export const SwapAgent = makeAssistantToolUI<SwapAgentInput, SwapAgentOutput>({
  toolName: 'swapAgentTool',
  render: SwapAgentContent,
})
