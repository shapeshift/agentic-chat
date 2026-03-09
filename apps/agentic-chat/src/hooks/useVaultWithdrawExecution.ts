import type { VaultWithdrawOutput } from '@shapeshiftoss/agentic-server'
import type { DynamicToolUIPart } from 'ai'
import { toast } from 'sonner'

import type { ToolExecutionState, VaultWithdrawMeta } from '@/lib/executionState'
import { getStepStatus } from '@/lib/executionState'
import { StepStatus } from '@/lib/stepUtils'

import { submitSafeTxStep } from './steps/submitSafeTxStep'
import { switchNetworkStepByChainIdNumber } from './steps/switchNetworkStep'
import { useExecuteOnce } from './useExecuteOnce'
import { useToolExecution } from './useToolExecution'

export const VAULT_WITHDRAW_STEPS = { PREPARE: 0, NETWORK: 1, WITHDRAW: 2 } as const

interface VaultWithdrawStepInfo {
  step: number
  status: StepStatus
}

interface UseVaultWithdrawExecutionResult {
  state: ToolExecutionState<VaultWithdrawMeta>
  steps: VaultWithdrawStepInfo[]
  networkName?: string
  error?: string
  withdrawTxHash?: string
}

export const useVaultWithdrawExecution = (
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  withdrawData: VaultWithdrawOutput | null
): UseVaultWithdrawExecutionResult => {
  const ctx = useToolExecution<VaultWithdrawMeta>(toolCallId, 'vault_withdraw', {})

  useExecuteOnce(ctx, withdrawData, async (data, ctx) => {
    try {
      const { safeTransaction, summary } = data

      if (!ctx.refs.evmAddress.current) {
        throw new Error('Wallet disconnected. Please reconnect and try again.')
      }

      // Step 0: Prepare complete
      ctx.setState(draft => {
        draft.toolOutput = data
        draft.meta.networkName = data.summary.network
      })
      ctx.advanceStep()

      // Step 1: Network switch
      await switchNetworkStepByChainIdNumber(ctx, safeTransaction.chainId)

      // Step 2: Withdraw via Safe transaction
      const withdrawTxHash = await submitSafeTxStep(ctx, {
        safeAddress: summary.safeAddress,
        to: safeTransaction.to,
        data: safeTransaction.data,
        value: safeTransaction.value,
        chainId: safeTransaction.chainId,
      })
      ctx.setMeta({ withdrawTxHash })
      ctx.markTerminal()
      ctx.persist()

      toast.success(`Vault withdrawal of ${data.summary.asset.amount} ${data.summary.asset.symbol.toUpperCase()} is complete`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      ctx.setState(draft => {
        draft.error = errorMessage
        draft.failedStep = draft.currentStep
        draft.terminal = true
      })
      ctx.persist()

      toast.error(`Vault withdrawal failed`)
    }
  })

  const prepareStepStatus = (() => {
    if (toolState === 'output-error') return StepStatus.FAILED
    if (toolState === 'input-streaming' || toolState === 'input-available') return StepStatus.IN_PROGRESS
    if (toolState === 'output-available') return StepStatus.COMPLETE
    return StepStatus.NOT_STARTED
  })()

  return {
    state: ctx.state,
    steps: [
      { step: VAULT_WITHDRAW_STEPS.PREPARE, status: prepareStepStatus },
      { step: VAULT_WITHDRAW_STEPS.NETWORK, status: getStepStatus(VAULT_WITHDRAW_STEPS.NETWORK, ctx.state) },
      { step: VAULT_WITHDRAW_STEPS.WITHDRAW, status: getStepStatus(VAULT_WITHDRAW_STEPS.WITHDRAW, ctx.state) },
    ],
    networkName: withdrawData?.summary?.network,
    error: ctx.state.error,
    withdrawTxHash: ctx.state.meta.withdrawTxHash,
  }
}
