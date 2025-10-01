import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { PortfolioToolInput, PortfolioToolOutput } from '@shapeshiftoss/agentic-server'
import { chainIdToNetwork } from '@shapeshiftoss/types'

import { StatusText } from './StatusText'

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

  if (status.type === 'running') {
    return <StatusText.Loading>Fetching {porfolioDetailsText}</StatusText.Loading>
  }

  if (isError || !result || ('code' in result && result.code === 'TOOL_EXECUTION_FAILED')) {
    return <StatusText.Error>Failed to fetch {porfolioDetailsText} ❌</StatusText.Error>
  }

  return <StatusText.Success>Fetched {porfolioDetailsText} ✅</StatusText.Success>
}

export const Portfolio = makeAssistantToolUI<PortfolioToolInput, PortfolioToolOutput>({
  toolName: 'portfolioTool',
  render: PortfolioContent,
})
