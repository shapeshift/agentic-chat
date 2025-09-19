import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { PortfolioWorkflowInput, PortfolioWorkflowResults } from '@shapeshiftoss/agentic-server'
import { chainIdToNetwork } from '@shapeshiftoss/types'

import { TextComplete } from '@/components/TextComplete'
import { TextShimmer } from '@/components/TextShimmer'

type PortfolioWorkflowContentProps = Omit<
  ToolCallMessagePartProps<PortfolioWorkflowInput, PortfolioWorkflowResults>,
  'args'
> & {
  args: Partial<PortfolioWorkflowInput>
}

const PortfolioWorkflowContent: React.FC<PortfolioWorkflowContentProps> = ({ status, result, args, isError }) => {
  const porfolioDetailsText = (() => {
    const parts = ['portfolio details']
    if (args.account) parts.push(`for ${args.account}`)
    if (args.account && args.chainId) parts.push(`on ${chainIdToNetwork[args.chainId]}`)
    return parts.join(' ')
  })()

  switch (status.type) {
    case 'running': {
      return <TextShimmer>{`Fetching ${porfolioDetailsText}`}</TextShimmer>
    }
    case 'complete': {
      if (isError || !result || ('code' in result && result.code === 'TOOL_EXECUTION_FAILED')) {
        return <TextComplete>{`Failed to fetch ${porfolioDetailsText} ❌`}</TextComplete>
      }

      return <TextComplete>{`Fetch ${porfolioDetailsText} ✅`}</TextComplete>
    }
  }
}

export const PortfolioWorkflow = makeAssistantToolUI<PortfolioWorkflowInput, PortfolioWorkflowResults>({
  toolName: 'portfolioWorkflow',
  render: PortfolioWorkflowContent,
})
