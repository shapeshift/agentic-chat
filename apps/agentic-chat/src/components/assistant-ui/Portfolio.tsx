import type { ToolCallContentPartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { PortfolioAgentInput, PortfolioAgentOutput } from '@shapeshiftoss/agentic-server'
import { Wallet } from 'lucide-react'

import { TextShimmer } from '@/components/TextShimmer'

import { CollapsableDetails } from './CollapsableDetails'

const Icon = Wallet

type PortfolioContentProps = Omit<ToolCallContentPartProps<PortfolioAgentInput, PortfolioAgentOutput>, 'args'> & {
  args: Partial<PortfolioAgentInput>
}

const PortfolioContent: React.FC<PortfolioContentProps> = ({ status, result, args, isError, toolName }) => {
  switch (status.type) {
    case 'running':
    case 'requires-action':
    case 'incomplete': {
      if (!args.prompt) return <TextShimmer>Getting account</TextShimmer>

      return <TextShimmer>{args.prompt}</TextShimmer>
    }
    case 'complete': {
      if (isError || !result) {
        return (
          <CollapsableDetails
            title={`An error occurred with ${toolName}`}
            leftIcon={<Icon className="w-4 h-4 text-red-500" />}
          >
            {JSON.stringify(result || 'Failed to get account details')}
          </CollapsableDetails>
        )
      }
      return (
        <CollapsableDetails title="Account details" leftIcon={<Icon className="w-4 h-4 text-green-500" />}>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </CollapsableDetails>
      )
    }
  }
}

export const Portfolio = makeAssistantToolUI<PortfolioAgentInput, PortfolioAgentOutput>({
  toolName: 'portfolioAgent',
  render: PortfolioContent,
})
