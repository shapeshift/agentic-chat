import type { DynamicToolUIPart } from 'ai'
import type { ComponentType } from 'react'

import { GetAccountUI } from './tools/GetAccountUI'
import { GetAllowanceUI } from './tools/GetAllowanceUI'
import { GetAssetsUI } from './tools/GetAssetsUI'
import { GetTransactionHistoryUI } from './tools/GetTransactionHistoryUI'
import { InitiateSwapUI } from './tools/InitiateSwapUI'
import { NewCoinsUI } from './tools/NewCoinsUI'
import { PortfolioUI } from './tools/PortfolioUI'
import { ReceiveUI } from './tools/ReceiveUI'
import { SendUI } from './tools/SendUI'
import { SwitchNetworkUI } from './tools/SwitchNetworkUI'
import { TopGainersLosersUI } from './tools/TopGainersLosersUI'
import { TrendingTokensUI } from './tools/TrendingTokensUI'

interface ToolUIProps {
  toolPart: DynamicToolUIPart
}

type ToolUIComponent = ComponentType<ToolUIProps>

export const TOOL_UI_REGISTRY: Record<string, ToolUIComponent> = {
  initiateSwapTool: InitiateSwapUI,
  initiateSwapUsdTool: InitiateSwapUI,
  switchNetworkTool: SwitchNetworkUI,
  portfolioTool: PortfolioUI,
  getAssetsTool: GetAssetsUI,
  lookupExternalAddress: GetAccountUI,
  getTransactionHistoryTool: GetTransactionHistoryUI,
  transactionHistoryTool: GetTransactionHistoryUI,
  getAllowanceTool: GetAllowanceUI,
  sendTool: SendUI,
  receiveTool: ReceiveUI,
  getTrendingTokensTool: TrendingTokensUI,
  getTopGainersLosersTool: TopGainersLosersUI,
  getNewCoinsTool: NewCoinsUI,
} as const

export function getToolUIComponent(toolName: string): ToolUIComponent | undefined {
  return TOOL_UI_REGISTRY[toolName]
}
