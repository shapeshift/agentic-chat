import type { VaultDepositOutput } from '@shapeshiftoss/agentic-server'
import { fromChainId } from '@shapeshiftoss/caip'
import type { DynamicToolUIPart } from 'ai'
import { toast } from 'sonner'

import type { ToolExecutionState, VaultDepositMeta } from '@/lib/executionState'
import { getStepStatus } from '@/lib/executionState'
import { StepStatus } from '@/lib/stepUtils'
import { sendTransaction } from '@/utils/sendTransaction'

import { switchNetworkStepByChainIdNumber } from './steps/switchNetworkStep'
import { useExecuteOnce } from './useExecuteOnce'
import { useToolExecution } from './useToolExecution'

export const VAULT_DEPOSIT_STEPS = { PREPARE: 0, NETWORK: 1, DEPOSIT: 2 } as const

interface VaultDepositStepInfo {
  step: number
  status: StepStatus
}

interface UseVaultDepositExecutionResult {
  state: ToolExecutionState<VaultDepositMeta>
  steps: VaultDepositStepInfo[]
  networkName?: string
  error?: string
  depositTxHash?: string
}

export const useVaultDepositExecution = (
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  depositData: VaultDepositOutput | null
): UseVaultDepositExecutionResult => {
  const ctx = useToolExecution<VaultDepositMeta>(toolCallId, 'vault_deposit', {})

  useExecuteOnce(ctx, depositData, async (data, ctx) => {
    try {
      const { depositTx } = data

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
      const { chainReference } = fromChainId(depositTx.chainId)
      await switchNetworkStepByChainIdNumber(ctx, Number(chainReference))

      // Step 2: Deposit (EOA -> Safe transfer)
      const depositTxHash = await sendTransaction({
        chainId: depositTx.chainId,
        data: depositTx.data,
        from: depositTx.from,
        to: depositTx.to,
        value: depositTx.value,
      })
      ctx.setMeta({ depositTxHash })
      ctx.advanceStep()
      ctx.markTerminal()
      ctx.persist()

      toast.success(`Vault deposit of ${data.summary.asset.amount} ${data.summary.asset.symbol.toUpperCase()} is complete`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      ctx.setState(draft => {
        draft.error = errorMessage
        draft.failedStep = draft.currentStep
        draft.terminal = true
      })
      ctx.persist()

      toast.error(`Vault deposit failed`)
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
      { step: VAULT_DEPOSIT_STEPS.PREPARE, status: prepareStepStatus },
      { step: VAULT_DEPOSIT_STEPS.NETWORK, status: getStepStatus(VAULT_DEPOSIT_STEPS.NETWORK, ctx.state) },
      { step: VAULT_DEPOSIT_STEPS.DEPOSIT, status: getStepStatus(VAULT_DEPOSIT_STEPS.DEPOSIT, ctx.state) },
    ],
    networkName: depositData?.summary?.network,
    error: ctx.state.error,
    depositTxHash: ctx.state.meta.depositTxHash,
  }
}
