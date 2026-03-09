import type {
  CancelLimitOrderOutput,
  CancelStopLossOutput,
  CreateLimitOrderOutput,
  CreateStopLossOutput,
  CreateTwapOutput,
  InitiateSwapOutput,
  SendOutput,
  SwitchNetworkOutput,
  VaultDepositOutput,
  VaultWithdrawAllOutput,
  VaultWithdrawOutput,
} from '@shapeshiftoss/agentic-server'

import { StepStatus } from './stepUtils'

export type ToolType =
  | 'swap'
  | 'send'
  | 'network_switch'
  | 'limit_order'
  | 'cancel_limit_order'
  | 'stop_loss'
  | 'cancel_stop_loss'
  | 'twap'
  | 'cancel_twap'
  | 'vault_deposit'
  | 'vault_withdraw'
  | 'vault_withdraw_all'

export type ToolOutput =
  | InitiateSwapOutput
  | SendOutput
  | SwitchNetworkOutput
  | CreateLimitOrderOutput
  | CancelLimitOrderOutput
  | CreateStopLossOutput
  | CancelStopLossOutput
  | CreateTwapOutput
  | VaultDepositOutput
  | VaultWithdrawOutput
  | VaultWithdrawAllOutput

export interface ToolExecutionState<TMeta = Record<string, unknown>> {
  toolCallId: string
  toolType: ToolType
  conversationId: string
  timestamp: number
  walletAddress?: string
  toolOutput?: ToolOutput

  currentStep: number
  completedSteps: number[]
  skippedSteps: number[]
  failedStep?: number
  error?: string
  terminal: boolean

  meta: TMeta
}

export interface SwapMeta {
  [key: string]: unknown
  approvalTxHash?: string
  swapTxHash?: string
  networkName?: string
}

export interface SendMeta {
  sendTxHash?: string
  networkName?: string
}

export interface LimitOrderMeta {
  orderId?: string
  submitTxHash?: string
  approvalTxHash?: string
  networkName?: string
}

export interface ConditionalOrderMeta {
  approvalTxHash?: string
  depositTxHash?: string
  submitTxHash?: string
  orderId?: string
  networkName?: string
}

export interface CancelLimitOrderMeta {
  orderId?: string
  networkName?: string
}

export interface CancelConditionalOrderMeta {
  cancelTxHash?: string
}

export interface VaultDepositMeta {
  depositTxHash?: string
  networkName?: string
}

export interface VaultWithdrawMeta {
  withdrawTxHash?: string
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

export function advanceStep<TMeta>(state: ToolExecutionState<TMeta>): ToolExecutionState<TMeta> {
  const completedSteps = state.completedSteps.includes(state.currentStep)
    ? state.completedSteps
    : [...state.completedSteps, state.currentStep]
  return { ...state, completedSteps, currentStep: state.currentStep + 1, error: undefined }
}

export function failStep<TMeta>(state: ToolExecutionState<TMeta>, error: string): ToolExecutionState<TMeta> {
  return { ...state, failedStep: state.currentStep, error, terminal: true }
}

export function skipStep<TMeta>(state: ToolExecutionState<TMeta>): ToolExecutionState<TMeta> {
  const skippedSteps = state.skippedSteps.includes(state.currentStep)
    ? state.skippedSteps
    : [...state.skippedSteps, state.currentStep]
  return { ...state, skippedSteps, currentStep: state.currentStep + 1 }
}

export function markTerminal<TMeta>(state: ToolExecutionState<TMeta>): ToolExecutionState<TMeta> {
  return { ...state, terminal: true }
}

export function getStepStatus(step: number, state: ToolExecutionState): StepStatus {
  if (state.failedStep === step) return StepStatus.FAILED
  if (state.currentStep < step) return StepStatus.NOT_STARTED
  if (state.currentStep === step && !state.error) return StepStatus.IN_PROGRESS
  if (state.completedSteps.includes(step)) return StepStatus.COMPLETE
  if (state.skippedSteps?.includes(step)) return StepStatus.SKIPPED
  if (state.currentStep > step) return StepStatus.SKIPPED
  return StepStatus.NOT_STARTED
}
