import type { ComponentType } from 'react'

import type { ToolName } from '@/types/toolOutput'

import { CancelLimitOrderUI } from './tools/CancelLimitOrderUI'
import { CancelStopLossUI } from './tools/CancelStopLossUI'
import { CancelTwapUI } from './tools/CancelTwapUI'
import { CheckWalletCapabilitiesUI } from './tools/CheckWalletCapabilitiesUI'
import { GetAccountUI } from './tools/GetAccountUI'
import { GetAllowanceUI } from './tools/GetAllowanceUI'
import { GetAssetsUI } from './tools/GetAssetsUI'
import { GetLimitOrdersUI } from './tools/GetLimitOrdersUI'
import { GetStopLossOrdersUI } from './tools/GetStopLossOrdersUI'
import { GetTransactionHistoryUI } from './tools/GetTransactionHistoryUI'
import { GetTwapOrdersUI } from './tools/GetTwapOrdersUI'
import { InitiateSwapUI } from './tools/InitiateSwapUI'
import { LimitOrderUI } from './tools/LimitOrderUI'
import { NewCoinsUI } from './tools/NewCoinsUI'
import { PortfolioUI } from './tools/PortfolioUI'
import { ReceiveUI } from './tools/ReceiveUI'
import { SendUI } from './tools/SendUI'
import { StopLossUI } from './tools/StopLossUI'
import { SwitchNetworkUI } from './tools/SwitchNetworkUI'
import type { ToolRendererProps } from './tools/toolUIHelpers'
import { TopGainersLosersUI } from './tools/TopGainersLosersUI'
import { TrendingTokensUI } from './tools/TrendingTokensUI'
import { TwapUI } from './tools/TwapUI'
import { VaultDepositUI } from './tools/VaultDepositUI'
import { VaultWithdrawUI } from './tools/VaultWithdrawUI'

type ToolUIComponent = ComponentType<ToolRendererProps>

const TOOL_UI_REGISTRY: Record<ToolName, ToolUIComponent | null> = {
  sendTool: SendUI as ToolUIComponent,
  initiateSwapTool: InitiateSwapUI as ToolUIComponent,
  initiateSwapUsdTool: InitiateSwapUI as ToolUIComponent,
  switchNetworkTool: SwitchNetworkUI as ToolUIComponent,
  portfolioTool: PortfolioUI as ToolUIComponent,
  getAssetsTool: GetAssetsUI as ToolUIComponent,
  lookupExternalAddress: GetAccountUI as ToolUIComponent,
  transactionHistoryTool: GetTransactionHistoryUI as ToolUIComponent,
  getAllowanceTool: GetAllowanceUI as ToolUIComponent,
  receiveTool: ReceiveUI as ToolUIComponent,
  getTrendingTokensTool: TrendingTokensUI as ToolUIComponent,
  getTopGainersLosersTool: TopGainersLosersUI as ToolUIComponent,
  getNewCoinsTool: NewCoinsUI as ToolUIComponent,
  createLimitOrderTool: LimitOrderUI as ToolUIComponent,
  getLimitOrdersTool: GetLimitOrdersUI as ToolUIComponent,
  cancelLimitOrderTool: CancelLimitOrderUI as ToolUIComponent,
  createStopLossTool: StopLossUI as ToolUIComponent,
  getStopLossOrdersTool: GetStopLossOrdersUI as ToolUIComponent,
  cancelStopLossTool: CancelStopLossUI as ToolUIComponent,
  createTwapTool: TwapUI as ToolUIComponent,
  getTwapOrdersTool: GetTwapOrdersUI as ToolUIComponent,
  cancelTwapTool: CancelTwapUI as ToolUIComponent,
  checkWalletCapabilitiesTool: CheckWalletCapabilitiesUI as ToolUIComponent,
  vaultDepositTool: VaultDepositUI as ToolUIComponent,
  vaultWithdrawTool: VaultWithdrawUI as ToolUIComponent,
}

export function getToolUIComponent(toolName: string): ComponentType<ToolRendererProps> | null | undefined {
  return TOOL_UI_REGISTRY[toolName as ToolName]
}
