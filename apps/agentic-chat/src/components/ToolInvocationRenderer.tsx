import type { DynamicToolUIPart } from 'ai'

import { GetAccountUI } from './tools/GetAccountUI'
import { GetAllowanceUI } from './tools/GetAllowanceUI'
import { GetAssetsUI } from './tools/GetAssetsUI'
import { GetTransactionHistoryUI } from './tools/GetTransactionHistoryUI'
import { InitiateSwapUI } from './tools/InitiateSwapUI'
import { PortfolioUI } from './tools/PortfolioUI'
import { SwitchNetworkUI } from './tools/SwitchNetworkUI'

interface ToolInvocationRendererProps {
  toolPart: DynamicToolUIPart
}

export function ToolInvocationRenderer({ toolPart }: ToolInvocationRendererProps) {
  // Extract tool name from the type property (e.g., "tool-getAssetsTool" -> "getAssetsTool")
  const toolName = toolPart.type.startsWith('tool-') ? toolPart.type.replace('tool-', '') : toolPart.type

  // Use toolPart directly as it's already typed as DynamicToolUIPart
  const dynamicToolPart = toolPart

  // Switch based on tool name
  switch (toolName) {
    case 'initiateSwapTool':
    case 'initiateSwapUsdTool':
      return <InitiateSwapUI toolPart={dynamicToolPart} />

    case 'switchNetworkTool':
      return <SwitchNetworkUI toolPart={dynamicToolPart} />

    case 'portfolioTool':
      return <PortfolioUI toolPart={dynamicToolPart} />

    case 'getAssetsTool':
      return <GetAssetsUI toolPart={dynamicToolPart} />

    case 'getAccountTool':
      return <GetAccountUI toolPart={dynamicToolPart} />

    case 'getTransactionHistoryTool':
      return <GetTransactionHistoryUI toolPart={dynamicToolPart} />

    case 'getAllowanceTool':
      return <GetAllowanceUI toolPart={dynamicToolPart} />

    // Skip these tools (internal/hidden)
    case 'mathCalculatorTool':
    case 'getCoingeckoAssetsTool':
    case 'getPortalsAssetsTool':
      return null

    // Fallback for unknown tools
    default:
      return (
        <div className="rounded-lg border border-border bg-muted p-3 text-sm">
          <div className="font-medium">{toolName || 'Unknown tool'}</div>
          <div className="mt-2 text-xs text-muted-foreground">Tool execution in progress...</div>
        </div>
      )
  }
}
