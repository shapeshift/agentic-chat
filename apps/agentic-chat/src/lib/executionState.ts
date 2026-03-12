import type { ToolName } from '@/types/toolOutput'

import { StepStatus } from './stepUtils'

export interface ToolExecutionState<TMeta = unknown> {
  toolCallId: string
  toolName: ToolName
  conversationId: string
  timestamp: number
  walletAddress?: string
  toolOutput?: unknown

  currentStep: number
  completedSteps: number[]
  skippedSteps: number[]
  failedStep?: number
  error?: string
  terminal: boolean

  substatus?: string

  meta: TMeta
}

export interface SwapMeta {
  approvalTxHash?: string
  txHash?: string
  networkName?: string
}

export interface SendMeta {
  txHash?: string
  networkName?: string
}

export interface LimitOrderMeta {
  orderId?: string
  txHash?: string
  approvalTxHash?: string
  networkName?: string
}

export interface ConditionalOrderMeta {
  approvalTxHash?: string
  depositTxHash?: string
  txHash?: string
  orderId?: string
  networkName?: string
}

export interface CancelLimitOrderMeta {
  orderId?: string
  networkName?: string
}

export interface CancelConditionalOrderMeta {
  txHash?: string
}

export interface VaultDepositMeta {
  txHash?: string
  networkName?: string
}

export interface VaultWithdrawMeta {
  txHash?: string
  networkName?: string
}

export interface ChainResult {
  network: string
  chainId: number
  txHash?: string
  error?: string
}

export interface VaultWithdrawAllMeta {
  chainResults: ChainResult[]
  currentChainIndex?: number
}

export type NetworkSwitchPhase = 'idle' | 'switching' | 'success' | 'error'

export interface NetworkSwitchMeta {
  network?: string
  phase: NetworkSwitchPhase
}

export type ToolMetaMap = {
  sendTool: SendMeta
  initiateSwapTool: SwapMeta
  initiateSwapUsdTool: SwapMeta
  switchNetworkTool: NetworkSwitchMeta
  portfolioTool: Record<string, never>
  getAssetsTool: Record<string, never>
  lookupExternalAddress: Record<string, never>
  transactionHistoryTool: Record<string, never>
  getAllowanceTool: Record<string, never>
  receiveTool: Record<string, never>
  getTrendingTokensTool: Record<string, never>
  getTopGainersLosersTool: Record<string, never>
  getNewCoinsTool: Record<string, never>
  createLimitOrderTool: LimitOrderMeta
  getLimitOrdersTool: Record<string, never>
  cancelLimitOrderTool: CancelLimitOrderMeta
  createStopLossTool: ConditionalOrderMeta
  getStopLossOrdersTool: Record<string, never>
  cancelStopLossTool: CancelConditionalOrderMeta
  createTwapTool: ConditionalOrderMeta
  getTwapOrdersTool: Record<string, never>
  cancelTwapTool: CancelConditionalOrderMeta
  checkWalletCapabilitiesTool: Record<string, never>
  vaultDepositTool: VaultDepositMeta
  vaultWithdrawTool: VaultWithdrawMeta
  vaultWithdrawAllTool: VaultWithdrawAllMeta
}

export type ToolExecutionStateFor<K extends ToolName> = Omit<ToolExecutionState, 'toolName' | 'meta'> & {
  toolName: K
  meta: ToolMetaMap[K]
}

export type AnyToolExecutionState = { [K in ToolName]: ToolExecutionStateFor<K> }[ToolName]

export function advanceStep<TMeta>(state: ToolExecutionState<TMeta>): ToolExecutionState<TMeta> {
  const completedSteps = state.completedSteps.includes(state.currentStep)
    ? state.completedSteps
    : [...state.completedSteps, state.currentStep]
  return { ...state, completedSteps, currentStep: state.currentStep + 1, error: undefined, substatus: undefined }
}

export function failStep<TMeta>(state: ToolExecutionState<TMeta>, error: string): ToolExecutionState<TMeta> {
  return { ...state, failedStep: state.currentStep, error, terminal: true, substatus: undefined }
}

export function skipStep<TMeta>(state: ToolExecutionState<TMeta>): ToolExecutionState<TMeta> {
  const skippedSteps = state.skippedSteps.includes(state.currentStep)
    ? state.skippedSteps
    : [...state.skippedSteps, state.currentStep]
  return { ...state, skippedSteps, currentStep: state.currentStep + 1, substatus: undefined }
}

export function markTerminal<TMeta>(state: ToolExecutionState<TMeta>): ToolExecutionState<TMeta> {
  return { ...state, terminal: true }
}

export function toolStateToStepStatus(toolState: string): StepStatus {
  if (toolState === 'output-error') return StepStatus.FAILED
  if (toolState === 'input-streaming' || toolState === 'input-available') return StepStatus.IN_PROGRESS
  if (toolState === 'output-available') return StepStatus.COMPLETE
  return StepStatus.NOT_STARTED
}

export function getStepStatus(step: number, state: ToolExecutionState<unknown>): StepStatus {
  if (state.failedStep === step) return StepStatus.FAILED
  if (state.currentStep < step) return StepStatus.NOT_STARTED
  if (state.currentStep === step && !state.error) return StepStatus.IN_PROGRESS
  if (state.completedSteps.includes(step)) return StepStatus.COMPLETE
  if (state.skippedSteps?.includes(step)) return StepStatus.SKIPPED
  if (state.currentStep > step) return StepStatus.SKIPPED
  return StepStatus.NOT_STARTED
}
