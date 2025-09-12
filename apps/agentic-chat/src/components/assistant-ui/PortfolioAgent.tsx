import type { ToolCallContentPartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { PortfolioAgentInput, PortfolioAgentOutput } from '@shapeshiftoss/agentic-server'

import { TextComplete } from '@/components/TextComplete'
import { TextShimmer } from '@/components/TextShimmer'

type PortfolioAgentContentProps = Omit<ToolCallContentPartProps<PortfolioAgentInput, PortfolioAgentOutput>, 'args'> & {
  args: Partial<PortfolioAgentInput>
}

const PortfolioAgentContent: React.FC<PortfolioAgentContentProps> = ({ status, result, args, isError }) => {
  switch (status.type) {
    case 'running': {
      if (!args.prompt) return null
      return <TextShimmer>{args.prompt}</TextShimmer>
    }
    case 'complete': {
      if (isError || !result || ('code' in result && result.code === 'TOOL_EXECUTION_FAILED')) {
        if (!args.user) return <TextComplete>{'Failed to gather portfolio data ❌'}</TextComplete>
        return <TextComplete>{`Failed to gather portfolio data for ${args.user} ❌`}</TextComplete>
      }

      if (!args.user) return <TextComplete>{'Portfolio data gathered successfully ✅'}</TextComplete>
      return <TextComplete>{`Porfolio data gathered for ${args.user} ✅`}</TextComplete>
    }
  }
}

export const PortfolioAgent = makeAssistantToolUI<PortfolioAgentInput, PortfolioAgentOutput>({
  toolName: 'portfolioAgentTool',
  render: PortfolioAgentContent,
})
