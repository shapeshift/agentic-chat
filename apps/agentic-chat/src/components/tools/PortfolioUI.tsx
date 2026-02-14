import { useToolStateRender } from './toolUIHelpers'
import type { ToolUIComponentProps } from './toolUIHelpers'

export function PortfolioUI({ toolPart }: ToolUIComponentProps<'portfolioTool'>) {
  const input = toolPart.input as Partial<Record<string, unknown>> | undefined
  const { state } = toolPart

  const portfolioDetailsText = (() => {
    const parts = ['portfolio details']
    if (input?.network !== undefined) {
      const network = String(input.network as string)
      parts.push(`on ${network}`)
    }
    return parts.join(' ')
  })()

  const stateRender = useToolStateRender(state, {
    loading: `Fetching ${portfolioDetailsText}`,
    error: `Failed to fetch ${portfolioDetailsText} ❌`,
    success: `Fetched ${portfolioDetailsText} ✅`,
  })

  if (stateRender) return stateRender

  return null
}
