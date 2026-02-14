import type {
  AssetWithMarketData,
  CancelLimitOrderOutput,
  CancelStopLossOutput,
  CancelTwapOutput,
  CheckWalletCapabilitiesOutput,
  CreateLimitOrderOutput,
  CreateStopLossOutput,
  CreateTwapOutput,
  GetLimitOrdersOutput,
  GetStopLossOrdersOutput,
  GetTwapOrdersOutput,
  InitiateSwapOutput,
  PortfolioOutput,
  ReceiveOutput,
  SendOutput,
  SwitchNetworkOutput,
  TrimmedGainerLoserCoin,
  TrimmedNewCoin,
  TrimmedTrendingCoin,
  VaultDepositOutput,
  VaultWithdrawOutput,
} from '@shapeshiftoss/agentic-server'
import type { ParsedTransaction } from '@shapeshiftoss/types'

export type ToolOutputMap = {
  sendTool: SendOutput
  initiateSwapTool: InitiateSwapOutput
  initiateSwapUsdTool: InitiateSwapOutput
  switchNetworkTool: SwitchNetworkOutput
  portfolioTool: PortfolioOutput
  getAssetsTool: { assets: AssetWithMarketData[] }
  lookupExternalAddress: never
  transactionHistoryTool: { transactions?: ParsedTransaction[]; metadata?: { networksChecked?: string[] } }
  getAllowanceTool: unknown
  receiveTool: ReceiveOutput
  getTrendingTokensTool: { tokens: TrimmedTrendingCoin[] }
  getTopGainersLosersTool: { gainers: TrimmedGainerLoserCoin[]; losers: TrimmedGainerLoserCoin[]; duration: string }
  getNewCoinsTool: { coins: TrimmedNewCoin[] }
  createLimitOrderTool: CreateLimitOrderOutput
  getLimitOrdersTool: GetLimitOrdersOutput
  cancelLimitOrderTool: CancelLimitOrderOutput
  createStopLossTool: CreateStopLossOutput
  getStopLossOrdersTool: GetStopLossOrdersOutput
  cancelStopLossTool: CancelStopLossOutput
  createTwapTool: CreateTwapOutput
  getTwapOrdersTool: GetTwapOrdersOutput
  cancelTwapTool: CancelTwapOutput
  checkWalletCapabilitiesTool: CheckWalletCapabilitiesOutput
  vaultDepositTool: VaultDepositOutput
  vaultWithdrawTool: VaultWithdrawOutput
}

export type ToolName = keyof ToolOutputMap
