import type { DynamicToolUIPart } from 'ai'

import { StatusText } from '../ui/StatusText'

interface PortfolioUIProps {
  toolPart: DynamicToolUIPart
}

export function PortfolioUI({ toolPart }: PortfolioUIProps) {
  const input = toolPart.input as Partial<Record<string, unknown>> | undefined
  const { state } = toolPart

  const portfolioDetailsText = (() => {
    const parts = ['portfolio details']
    if (input?.network !== undefined) {
      parts.push(`on ${input.network}`)
    }
    return parts.join(' ')
  })()

  if (state === 'input-streaming' || state === 'input-available') {
    return <StatusText.Loading>Fetching {portfolioDetailsText}</StatusText.Loading>
  }

  if (state === 'output-error') {
    return <StatusText.Error>Failed to fetch {portfolioDetailsText} ❌</StatusText.Error>
  }

  return <StatusText.Success>Fetched {portfolioDetailsText} ✅</StatusText.Success>
}
