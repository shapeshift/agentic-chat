import type { DynamicToolUIPart } from 'ai'
import type { ReactNode } from 'react'
import { toast } from 'sonner'

import { useExecuteOnce } from '@/hooks/useExecuteOnce'
import type { ExecutionContext } from '@/hooks/useToolExecution'
import { useToolExecution } from '@/hooks/useToolExecution'
import type { ConditionalOrderMeta, ToolExecutionState } from '@/lib/executionState'
import { getStepStatus, toolStateToStepStatus } from '@/lib/executionState'
import { ensureSafeReady, executeSafeTransaction } from '@/lib/safe'
import { switchNetworkStepByChainIdNumber } from '@/lib/steps/switchNetworkStep'
import type { StepStatus } from '@/lib/stepUtils'
import { withWalletLock } from '@/lib/walletMutex'
import type { OrderRecord } from '@/stores/orderStore'
import { useOrderStore } from '@/stores/orderStore'
import { sendTransaction } from '@/utils/sendTransaction'
import { waitForConfirmedReceipt } from '@/utils/waitForConfirmedReceipt'

export const CONDITIONAL_ORDER_STEPS = {
  PREPARE: 0,
  NETWORK: 1,
  SAFE_CHECK: 2,
  DEPOSIT: 3,
  APPROVE: 4,
  SUBMIT: 5,
} as const

export interface ConditionalOrderData {
  summary: { network: string; sellAsset: { symbol: string }; buyAsset: { symbol: string } }
  safeTransaction: { to: string; data: string; value: string; chainId: number }
  needsApproval: boolean
  approvalTx?: { chainId: string; data: string; from: string; to: string; value: string }
  needsDeposit: boolean
  depositTx?: { chainId: string; data: string; from: string; to: string; value: string }
  orderHash: string
  conditionalOrderParams: { handler: string; salt: string; staticInput: string }
  sellTokenAddress: string
  buyTokenAddress: string
  sellAmountBaseUnit: string
  sellPrecision: number
  buyPrecision: number
}

export interface ConditionalOrderConfig<TData extends ConditionalOrderData> {
  toolName: 'createStopLossTool' | 'createTwapTool'
  orderType: OrderRecord['orderType']
  errorLabel: string
  toOrderRecord: (ctx: { data: TData; safeAddress: string; submitTxHash: string; chainId: number }) => OrderRecord
  renderSuccessToast: (data: TData) => ReactNode
  onSuccess?: (data: TData) => void
}

interface ConditionalOrderStepInfo {
  step: number
  status: StepStatus
}

export interface UseConditionalOrderExecutionResult {
  state: ToolExecutionState<ConditionalOrderMeta>
  steps: ConditionalOrderStepInfo[]
  networkName?: string
  error?: string
  submitTxHash?: string
}

async function ensureSafeReadyStep<TMeta extends object>(
  ctx: ExecutionContext<TMeta>,
  ownerAddress: string,
  chainId: number
): Promise<string> {
  if (!ctx.refs.evmWallet.current) throw new Error('EVM wallet not connected')
  const walletClient = await ctx.refs.evmWallet.current.getWalletClient()
  ctx.setSubstatus('Initializing Safe wallet...')
  const safeAddress = await ensureSafeReady(ownerAddress, chainId, ownerAddress, walletClient)
  ctx.advanceStep()
  return safeAddress
}

async function depositStep(
  ctx: ExecutionContext<ConditionalOrderMeta>,
  data: ConditionalOrderData,
  chainId: number
): Promise<void> {
  if (!data.needsDeposit || !data.depositTx) {
    ctx.skipStep()
    return
  }

  ctx.setSubstatus('Requesting signature...')
  const depositTxHash = await sendTransaction({
    chainId: data.depositTx.chainId,
    data: data.depositTx.data,
    from: data.depositTx.from,
    to: data.depositTx.to,
    value: data.depositTx.value,
  })
  ctx.setMeta({ depositTxHash } as Partial<ConditionalOrderMeta>)
  ctx.setSubstatus('Waiting for confirmation...')
  await waitForConfirmedReceipt(chainId, depositTxHash as `0x${string}`)
  ctx.advanceStep()
}

async function approveViaSafeStep(
  ctx: ExecutionContext<ConditionalOrderMeta>,
  data: ConditionalOrderData,
  safeAddress: string,
  chainId: number
): Promise<void> {
  if (!data.needsApproval || !data.approvalTx) {
    ctx.skipStep()
    return
  }

  if (!ctx.refs.evmWallet.current) throw new Error('EVM wallet not connected')
  if (!ctx.refs.evmAddress.current) throw new Error('Wallet disconnected')

  const walletClient = await ctx.refs.evmWallet.current.getWalletClient()
  ctx.setSubstatus('Proposing Safe transaction...')
  const approvalTxHash = await executeSafeTransaction(
    safeAddress,
    { to: data.approvalTx.to, data: data.approvalTx.data, value: data.approvalTx.value },
    ctx.refs.evmAddress.current,
    chainId,
    walletClient
  )
  ctx.setMeta({ approvalTxHash } as Partial<ConditionalOrderMeta>)
  ctx.advanceStep()
}

export function useConditionalOrderExecution<TData extends ConditionalOrderData>(
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  orderData: TData | null,
  config: ConditionalOrderConfig<TData>
): UseConditionalOrderExecutionResult {
  const ctx = useToolExecution(toolCallId, config.toolName, {})

  useExecuteOnce(ctx, orderData, async (data, ctx) => {
    await withWalletLock(async () => {
      try {
        const { safeTransaction } = data
        const targetChainId = safeTransaction.chainId

        if (!ctx.refs.evmAddress.current) {
          throw new Error('Wallet disconnected. Please reconnect and try again.')
        }

        // Step 0: Prepare
        ctx.setState(draft => {
          draft.toolOutput = data as unknown
          draft.meta.networkName = data.summary.network
        })
        ctx.advanceStep()

        // Step 1: Network switch
        await switchNetworkStepByChainIdNumber(ctx, targetChainId)

        // Step 2: Safe check — deploy Safe + enable ComposableCoW modules
        const safeAddress = await ensureSafeReadyStep(ctx, ctx.refs.evmAddress.current, targetChainId)

        // Step 3: Deposit — transfer sell tokens from EOA to Safe (if needed)
        await depositStep(ctx, data, targetChainId)

        // Step 4: Approve via Safe (if needed)
        await approveViaSafeStep(ctx, data, safeAddress, targetChainId)

        // Step 5: Submit to ComposableCoW via Safe
        if (!ctx.refs.evmWallet.current) throw new Error('EVM wallet not connected')
        if (!ctx.refs.evmAddress.current) throw new Error('Wallet disconnected')

        const walletClient = await ctx.refs.evmWallet.current.getWalletClient()
        ctx.setSubstatus('Proposing Safe transaction...')
        const submitTxHash = await executeSafeTransaction(
          safeAddress,
          { to: safeTransaction.to, data: safeTransaction.data, value: safeTransaction.value },
          ctx.refs.evmAddress.current,
          targetChainId,
          walletClient
        )
        ctx.setMeta({ txHash: submitTxHash } as Partial<ConditionalOrderMeta>)
        ctx.advanceStep()
        ctx.markTerminal()
        ctx.persist()

        useOrderStore
          .getState()
          .saveOrder(config.toOrderRecord({ data, safeAddress, submitTxHash, chainId: targetChainId }))

        toast.success(config.renderSuccessToast(data))
        config.onSuccess?.(data)
      } catch (error) {
        const errorMessage = ctx.failAndPersist(error)

        toast.error(
          <span>
            Failed to set {config.errorLabel}:{' '}
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
      { step: CONDITIONAL_ORDER_STEPS.PREPARE, status: prepareStepStatus },
      { step: CONDITIONAL_ORDER_STEPS.NETWORK, status: getStepStatus(CONDITIONAL_ORDER_STEPS.NETWORK, ctx.state) },
      {
        step: CONDITIONAL_ORDER_STEPS.SAFE_CHECK,
        status: getStepStatus(CONDITIONAL_ORDER_STEPS.SAFE_CHECK, ctx.state),
      },
      { step: CONDITIONAL_ORDER_STEPS.DEPOSIT, status: getStepStatus(CONDITIONAL_ORDER_STEPS.DEPOSIT, ctx.state) },
      { step: CONDITIONAL_ORDER_STEPS.APPROVE, status: getStepStatus(CONDITIONAL_ORDER_STEPS.APPROVE, ctx.state) },
      { step: CONDITIONAL_ORDER_STEPS.SUBMIT, status: getStepStatus(CONDITIONAL_ORDER_STEPS.SUBMIT, ctx.state) },
    ],
    networkName: orderData?.summary?.network,
    error: ctx.state.error,
    submitTxHash: ctx.state.meta.txHash,
  }
}
