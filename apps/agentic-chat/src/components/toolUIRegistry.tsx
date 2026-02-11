import type { DynamicToolUIPart } from 'ai'
import type { ComponentType } from 'react'

import { CancelLimitOrderUI } from './tools/CancelLimitOrderUI'
import { CancelStopLossUI } from './tools/CancelStopLossUI'
import { CheckWalletCapabilitiesUI } from './tools/CheckWalletCapabilitiesUI'
import { GetAccountUI } from './tools/GetAccountUI'
import { GetAllowanceUI } from './tools/GetAllowanceUI'
import { GetAssetsUI } from './tools/GetAssetsUI'
import { GetLimitOrdersUI } from './tools/GetLimitOrdersUI'
import { GetStopLossOrdersUI } from './tools/GetStopLossOrdersUI'
import { GetTransactionHistoryUI } from './tools/GetTransactionHistoryUI'
import { InitiateSwapUI } from './tools/InitiateSwapUI'
import { LimitOrderUI } from './tools/LimitOrderUI'
import { NewCoinsUI } from './tools/NewCoinsUI'
import { PortfolioUI } from './tools/PortfolioUI'
import { ReceiveUI } from './tools/ReceiveUI'
import { SendUI } from './tools/SendUI'
import { StopLossUI } from './tools/StopLossUI'
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
  createLimitOrderTool: LimitOrderUI,
  getLimitOrdersTool: GetLimitOrdersUI,
  cancelLimitOrderTool: CancelLimitOrderUI,
  createStopLossTool: StopLossUI,
  getStopLossOrdersTool: GetStopLossOrdersUI,
  cancelStopLossTool: CancelStopLossUI,
  checkWalletCapabilitiesTool: CheckWalletCapabilitiesUI,
} as const

export function getToolUIComponent(toolName: string): ToolUIComponent | undefined {
  return TOOL_UI_REGISTRY[toolName]
}
