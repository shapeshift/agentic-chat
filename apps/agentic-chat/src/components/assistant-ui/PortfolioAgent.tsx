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
    case 'running':
    case 'requires-action':
    case 'incomplete': {
      if (!args.user) return <TextShimmer>{'Gathering portfolio data'}</TextShimmer>
      return <TextShimmer>{`Gathering portfolio for ${args.user}`}</TextShimmer>
    }
    case 'complete': {
      if (isError || !result) {
        if (!args.user) return <TextShimmer>{'Failed to gather portfolio data'}</TextShimmer>
        return <TextComplete>{`Failed to gather portfolio data for ${args.user}`}</TextComplete>
      }

      if (!args.user) return <TextComplete>{'Portfolio data gathered successfully'}</TextComplete>
      return <TextShimmer>{`Porfolio data gathered for ${args.user}`}</TextShimmer>
    }
  }
}

export const PortfolioAgent = makeAssistantToolUI<PortfolioAgentInput, PortfolioAgentOutput>({
  toolName: 'portfolioAgentTool',
  render: PortfolioAgentContent,
})
