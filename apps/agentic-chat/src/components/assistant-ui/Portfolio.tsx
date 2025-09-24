import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { PortfolioToolInput, PortfolioToolOutput } from '@shapeshiftoss/agentic-server'
import { chainIdToNetwork } from '@shapeshiftoss/types'

import { TextComplete } from '@/components/TextComplete'
import { TextShimmer } from '@/components/TextShimmer'

type PortfolioContentProps = Omit<ToolCallMessagePartProps<PortfolioToolInput, PortfolioToolOutput>, 'args'> & {
  args: Partial<PortfolioToolInput>
}

const PortfolioContent: React.FC<PortfolioContentProps> = ({ status, result, args, isError }) => {
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

export const Portfolio = makeAssistantToolUI<PortfolioToolInput, PortfolioToolOutput>({
  toolName: 'portfolioTool',
  render: PortfolioContent,
})
