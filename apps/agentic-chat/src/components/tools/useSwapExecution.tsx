import type { InitiateSwapOutput } from '@shapeshiftoss/agentic-server'
import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'
import type { DynamicToolUIPart } from 'ai'
import { toast } from 'sonner'

import { Amount } from '@/components/ui/Amount'
import { useExecuteOnce } from '@/hooks/useExecuteOnce'
import { useToolExecution } from '@/hooks/useToolExecution'
import type { SwapMeta, ToolExecutionState } from '@/lib/executionState'
import { getStepStatus, toolStateToStepStatus } from '@/lib/executionState'
import { analytics } from '@/lib/mixpanel'
import { switchNetworkStep } from '@/lib/steps/switchNetworkStep'
import type { StepStatus } from '@/lib/stepUtils'
import { withWalletLock } from '@/lib/walletMutex'
import type { SolanaWalletSigner } from '@/utils/chains/types'
import { ensureAllowance } from '@/utils/ensureAllowance'
import { executeSwap } from '@/utils/swapExecutor'
import { waitForConfirmedReceipt } from '@/utils/waitForConfirmedReceipt'

export const SWAP_STEPS = { QUOTE: 0, NETWORK: 1, APPROVE: 2, SWAP: 3 } as const

type SwapData = InitiateSwapOutput

interface SwapStepInfo {
  step: number
  status: StepStatus
}

interface UseSwapExecutionResult {
  state: ToolExecutionState<SwapMeta>
  steps: SwapStepInfo[]
  networkName?: string
  error?: string
  approvalTxHash?: string
  swapTxHash?: string
}

export const useSwapExecution = (
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  swapData: SwapData | null
): UseSwapExecutionResult => {
  const ctx = useToolExecution(toolCallId, 'initiateSwapTool', {})

  useExecuteOnce(ctx, swapData, async (data, ctx) => {
    await withWalletLock(async () => {
      try {
        const { swapTx } = data

        if (!swapTx?.from) throw new Error('Invalid swap output: missing swapTx.from')
        if (!swapTx?.chainId) throw new Error('Invalid swap output: missing swapTx.chainId')
        if (!data.swapData?.sellAsset?.chainId)
          throw new Error('Invalid swap output: missing swapData.sellAsset.chainId')

        const sellAssetChainId = data.swapData.sellAsset.chainId
        const { chainNamespace, chainReference } = fromChainId(sellAssetChainId)

        const currentAddress =
          chainNamespace === CHAIN_NAMESPACE.Evm ? ctx.refs.evmAddress.current : ctx.refs.solanaAddress.current
        if (!currentAddress) throw new Error('Wallet disconnected. Please reconnect and try again.')
        if (currentAddress.toLowerCase() !== swapTx.from.toLowerCase()) {
          throw new Error('Wallet address changed. Please re-initiate the swap.')
        }

        let solanaSigner: SolanaWalletSigner | undefined
        if (chainNamespace === CHAIN_NAMESPACE.Solana && ctx.refs.solanaWallet.current) {
          solanaSigner = await ctx.refs.solanaWallet.current.getSigner()
        }

        // Step 0: Quote complete
        ctx.setState(draft => {
          draft.toolOutput = data
          draft.meta.networkName = data.swapData.sellAsset.network
        })
        ctx.advanceStep()

        // Step 1: Network switch
        await switchNetworkStep(ctx, sellAssetChainId)

        // Step 2: Approve — re-check on-chain allowance to handle parallel swaps
        ctx.setSubstatus('Checking allowance...')
        const approvalTxHash = await ensureAllowance({
          sellAssetId: data.swapData.sellAsset.assetId,
          sellAssetChainId: sellAssetChainId,
          sellAssetPrecision: data.swapData.sellAsset.precision,
          approvalTarget: data.swapData.approvalTarget,
          sellAmountCryptoPrecision: data.swapData.sellAmountCryptoPrecision,
          sellAccount: data.swapData.sellAccount,
          solanaSigner,
        })

        if (approvalTxHash) {
          ctx.setMeta({ approvalTxHash })
          if (chainNamespace === CHAIN_NAMESPACE.Evm) {
            ctx.setSubstatus('Waiting for confirmation...')
            await waitForConfirmedReceipt(Number(chainReference), approvalTxHash as `0x${string}`)
          }
          ctx.advanceStep()
        } else {
          ctx.skipStep()
        }

        // Step 3: Swap
        ctx.setSubstatus('Requesting signature...')
        const swapTxHash = await executeSwap(swapTx, { solanaSigner })
        ctx.setMeta({ txHash: swapTxHash })

        if (chainNamespace === CHAIN_NAMESPACE.Evm) {
          ctx.setSubstatus('Waiting for confirmation...')
          await waitForConfirmedReceipt(Number(chainReference), swapTxHash as `0x${string}`)
        }

        ctx.advanceStep()
        ctx.markTerminal()
        ctx.persist()

        analytics.trackSwap({
          sellAsset: data.swapData.sellAsset.symbol,
          buyAsset: data.swapData.buyAsset.symbol,
          sellAmount: data.swapData.sellAmountCryptoPrecision,
          buyAmount: data.swapData.buyAmountCryptoPrecision,
          network: data.swapData.sellAsset.network,
        })

        toast.success(
          <span>
            Your swap of{' '}
            <Amount.Crypto
              value={data.swapData.sellAmountCryptoPrecision}
              symbol={data.swapData.sellAsset.symbol.toUpperCase()}
              decimals={6}
              className="font-bold"
            />{' '}
            to{' '}
            <Amount.Crypto
              value={data.swapData.buyAmountCryptoPrecision}
              symbol={data.swapData.buyAsset.symbol.toUpperCase()}
              decimals={6}
              className="font-bold"
            />{' '}
            is complete
          </span>
        )
      } catch (error) {
        ctx.failAndPersist(error)

        toast.error(
          <span>
            Your swap of{' '}
            <Amount.Crypto
              value={data.swapData.sellAmountCryptoPrecision}
              symbol={data.swapData.sellAsset.symbol.toUpperCase()}
              decimals={6}
              className="font-bold"
            />{' '}
            to{' '}
            <Amount.Crypto
              value={data.swapData.buyAmountCryptoPrecision}
              symbol={data.swapData.buyAsset.symbol.toUpperCase()}
              decimals={6}
              className="font-bold"
            />{' '}
            failed
          </span>
        )
      }
    })
  })

  const quoteStepStatus = toolStateToStepStatus(toolState)

  return {
    state: ctx.state,
    steps: [
      { step: SWAP_STEPS.QUOTE, status: quoteStepStatus },
      { step: SWAP_STEPS.NETWORK, status: getStepStatus(SWAP_STEPS.NETWORK, ctx.state) },
      { step: SWAP_STEPS.APPROVE, status: getStepStatus(SWAP_STEPS.APPROVE, ctx.state) },
      { step: SWAP_STEPS.SWAP, status: getStepStatus(SWAP_STEPS.SWAP, ctx.state) },
    ],
    networkName: swapData?.swapData?.sellAsset?.network,
    error: ctx.state.error,
    approvalTxHash: ctx.state.meta.approvalTxHash,
    swapTxHash: ctx.state.meta.txHash,
  }
}
