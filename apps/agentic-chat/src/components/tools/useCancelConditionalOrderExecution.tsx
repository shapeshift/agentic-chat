import type { DynamicToolUIPart } from 'ai'
import type { ReactNode } from 'react'
import { toast } from 'sonner'

import { useExecuteOnce } from '@/hooks/useExecuteOnce'
import { useToolExecution } from '@/hooks/useToolExecution'
import type { CancelConditionalOrderMeta, ToolExecutionState } from '@/lib/executionState'
import { getStepStatus, toolStateToStepStatus } from '@/lib/executionState'
import { analytics } from '@/lib/mixpanel'
import { submitSafeTxStep } from '@/lib/steps/submitSafeTxStep'
import { switchNetworkStepByChainIdNumber } from '@/lib/steps/switchNetworkStep'
import type { StepStatus } from '@/lib/stepUtils'
import { withWalletLock } from '@/lib/walletMutex'
import { useOrderStore } from '@/stores/orderStore'

export const CANCEL_CONDITIONAL_STEPS = { PREPARE: 0, NETWORK: 1, SUBMIT_CANCEL: 2, CONFIRM_TX: 3 } as const

export interface CancelConditionalOrderData {
  safeTransaction: { to: string; data: string; value: string; chainId: number }
  safeAddress: string
  orderHash: string
  message: string
}

export interface CancelConditionalOrderConfig {
  toolName: 'cancelStopLossTool' | 'cancelTwapTool'
  orderLabel: string
  renderSuccessToast: (data: CancelConditionalOrderData) => ReactNode
  onSuccess?: (data: CancelConditionalOrderData) => void
}

interface CancelStepInfo {
  step: number
  status: StepStatus
}

export interface UseCancelConditionalOrderResult {
  state: ToolExecutionState<CancelConditionalOrderMeta>
  steps: CancelStepInfo[]
  error?: string
  cancelTxHash?: string
}

const CHAIN_ID_TO_NETWORK: Record<number, string> = { 1: 'ethereum', 100: 'gnosis', 42161: 'arbitrum' }

export function useCancelConditionalOrderExecution(
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  cancelData: CancelConditionalOrderData | null,
  config: CancelConditionalOrderConfig
): UseCancelConditionalOrderResult {
  const ctx = useToolExecution(toolCallId, config.toolName, {})

  useExecuteOnce(ctx, cancelData, async (data, ctx) => {
    await withWalletLock(async () => {
      try {
        const { safeTransaction, safeAddress } = data

        if (!ctx.refs.evmAddress.current) throw new Error('Wallet disconnected. Please reconnect and try again.')

        // Step 0: Prepare
        ctx.setState(draft => {
          draft.toolOutput = data as unknown
        })
        ctx.advanceStep()

        // Step 1: Network switch
        await switchNetworkStepByChainIdNumber(ctx, safeTransaction.chainId)

        // Step 2+3: Submit cancel via Safe (executeSafeTransaction already waits for on-chain confirmation)
        ctx.setSubstatus('Submitting cancellation...')
        const cancelTxHash = await submitSafeTxStep(ctx, {
          safeAddress,
          to: safeTransaction.to,
          data: safeTransaction.data,
          value: safeTransaction.value,
          chainId: safeTransaction.chainId,
        })
        ctx.setMeta({ txHash: cancelTxHash } as Partial<CancelConditionalOrderMeta>)
        ctx.advanceStep()
        ctx.markTerminal()
        ctx.persist()

        useOrderStore.getState().updateStatus(data.orderHash, safeAddress, 'cancelled')

        const network = CHAIN_ID_TO_NETWORK[safeTransaction.chainId] ?? 'unknown'
        if (config.toolName === 'cancelStopLossTool') {
          analytics.trackCancelStopLoss({ orderId: data.orderHash, network })
        } else {
          analytics.trackCancelTwap({ orderId: data.orderHash, network })
        }

        toast.success(config.renderSuccessToast(data))
        config.onSuccess?.(data)
      } catch (error) {
        const errorMessage = ctx.failAndPersist(error)

        toast.error(
          <span>
            Failed to cancel {config.orderLabel}:{' '}
            {errorMessage.length > 100 ? `${errorMessage.slice(0, 100)}...` : errorMessage}
          </span>
        )
      }
    })
  })

  const prepareStepStatus = toolStateToStepStatus(toolState)

  return {
    state: ctx.state,
    steps: [
      { step: CANCEL_CONDITIONAL_STEPS.PREPARE, status: prepareStepStatus },
      { step: CANCEL_CONDITIONAL_STEPS.NETWORK, status: getStepStatus(CANCEL_CONDITIONAL_STEPS.NETWORK, ctx.state) },
      {
        step: CANCEL_CONDITIONAL_STEPS.SUBMIT_CANCEL,
        status: getStepStatus(CANCEL_CONDITIONAL_STEPS.SUBMIT_CANCEL, ctx.state),
      },
      {
        step: CANCEL_CONDITIONAL_STEPS.CONFIRM_TX,
        status: getStepStatus(CANCEL_CONDITIONAL_STEPS.CONFIRM_TX, ctx.state),
      },
    ],
    error: ctx.state.error,
    cancelTxHash: ctx.state.meta.txHash,
  }
}
