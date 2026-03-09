import type { SendOutput } from '@shapeshiftoss/agentic-server'
import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'
import type { DynamicToolUIPart } from 'ai'
import { toast } from 'sonner'

import type { ToolExecutionState, SendMeta } from '@/lib/executionState'
import { getStepStatus } from '@/lib/executionState'
import { analytics } from '@/lib/mixpanel'
import { StepStatus } from '@/lib/stepUtils'
import type { SolanaWalletSigner } from '@/utils/chains/types'
import { executeSend } from '@/utils/sendExecutor'

import { switchNetworkStep } from './steps/switchNetworkStep'
import { useExecuteOnce } from './useExecuteOnce'
import { useToolExecution } from './useToolExecution'

export const SEND_STEPS = { PREPARE: 0, NETWORK: 1, SEND: 2 } as const

type SendData = SendOutput

interface SendStepInfo {
  step: number
  status: StepStatus
}

interface UseSendExecutionResult {
  state: ToolExecutionState<SendMeta>
  steps: SendStepInfo[]
  networkName?: string
  error?: string
  sendTxHash?: string
}

export const useSendExecution = (
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  sendData: SendData | null
): UseSendExecutionResult => {
  const ctx = useToolExecution<SendMeta>(toolCallId, 'send', {})

  useExecuteOnce(ctx, sendData, async (data, ctx) => {
    try {
      const { tx } = data

      if (!tx?.from) throw new Error('Invalid send output: missing tx.from')
      if (!tx?.chainId) throw new Error('Invalid send output: missing tx.chainId')
      if (!data.sendData?.chainId) throw new Error('Invalid send output: missing sendData.chainId')

      const assetChainId = data.sendData.chainId
      const { chainNamespace } = fromChainId(assetChainId)

      const currentAddress = chainNamespace === CHAIN_NAMESPACE.Evm
        ? ctx.refs.evmAddress.current
        : ctx.refs.solanaAddress.current
      if (!currentAddress) throw new Error('Wallet disconnected. Please reconnect and try again.')
      if (currentAddress.toLowerCase() !== tx.from.toLowerCase()) {
        throw new Error('Wallet address changed. Please re-initiate the transaction.')
      }

      let solanaSigner: SolanaWalletSigner | undefined
      if (chainNamespace === CHAIN_NAMESPACE.Solana && ctx.refs.solanaWallet.current) {
        solanaSigner = await ctx.refs.solanaWallet.current.getSigner()
      }

      // Step 0: Preparation complete
      ctx.setState(draft => {
        draft.toolOutput = data
        draft.meta.networkName = data.sendData.asset.network
      })
      ctx.advanceStep()

      // Step 1: Network switch
      await switchNetworkStep(ctx, assetChainId)

      // Step 2: Send
      const sendTxHash = await executeSend(tx, { solanaSigner })
      ctx.setMeta({ sendTxHash })
      ctx.advanceStep()
      ctx.markTerminal()
      ctx.persist()

      analytics.trackSend({
        asset: data.sendData.asset.symbol,
        amount: data.sendData.amount,
        network: data.sendData.asset.network,
      })

      toast.success(`Send of ${data.sendData.amount} ${data.sendData.asset.symbol.toUpperCase()} is complete`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      ctx.setState(draft => {
        draft.error = errorMessage
        draft.failedStep = draft.currentStep
        draft.terminal = true
      })
      ctx.persist()

      toast.error(`Send of ${data.sendData.amount} ${data.sendData.asset.symbol.toUpperCase()} failed`)
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
      { step: SEND_STEPS.PREPARE, status: prepareStepStatus },
      { step: SEND_STEPS.NETWORK, status: getStepStatus(SEND_STEPS.NETWORK, ctx.state) },
      { step: SEND_STEPS.SEND, status: getStepStatus(SEND_STEPS.SEND, ctx.state) },
    ],
    networkName: sendData?.sendData?.asset?.network,
    error: ctx.state.error,
    sendTxHash: ctx.state.meta.sendTxHash,
  }
}
