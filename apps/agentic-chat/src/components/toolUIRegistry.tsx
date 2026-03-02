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
import type { ToolRendererProps, ToolUIComponentProps } from './tools/toolUIHelpers'
import { TopGainersLosersUI } from './tools/TopGainersLosersUI'
import { TrendingTokensUI } from './tools/TrendingTokensUI'
import { TwapUI } from './tools/TwapUI'
import { VaultDepositUI } from './tools/VaultDepositUI'
import { VaultWithdrawAllUI } from './tools/VaultWithdrawAllUI'
import { VaultWithdrawUI } from './tools/VaultWithdrawUI'

type ToolUIComponentMap = {
  [K in ToolName]: ComponentType<ToolUIComponentProps<K>> | null
}

const TOOL_UI_REGISTRY: ToolUIComponentMap = {
  sendTool: SendUI,
  initiateSwapTool: InitiateSwapUI,
  initiateSwapUsdTool: InitiateSwapUI,
  switchNetworkTool: SwitchNetworkUI,
  portfolioTool: PortfolioUI,
  getAssetsTool: GetAssetsUI,
  lookupExternalAddress: GetAccountUI,
  transactionHistoryTool: GetTransactionHistoryUI,
  getAllowanceTool: GetAllowanceUI,
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
  createTwapTool: TwapUI,
  getTwapOrdersTool: GetTwapOrdersUI,
  cancelTwapTool: CancelTwapUI,
  checkWalletCapabilitiesTool: CheckWalletCapabilitiesUI,
  vaultDepositTool: VaultDepositUI,
  vaultWithdrawTool: VaultWithdrawUI,
  vaultWithdrawAllTool: VaultWithdrawAllUI,
}

export function getToolUIComponent(toolName: string): ComponentType<ToolRendererProps> | null | undefined {
  return TOOL_UI_REGISTRY[toolName as ToolName] as ComponentType<ToolRendererProps> | null | undefined
}
