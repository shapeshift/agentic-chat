import type { InitiateSwapOutput } from '@shapeshiftoss/agentic-server'
import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'
import type { DynamicToolUIPart } from 'ai'
import { useEffect, useRef, useState } from 'react'
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
import { refreshSwapQuote } from '@/services/swapService'
import type { SolanaWalletSigner } from '@/utils/chains/types'
import { ensureAllowance } from '@/utils/ensureAllowance'
import { assertQuoteFresh, prepareFreshSwap } from '@/utils/prepareFreshSwap'
import { executeSwap } from '@/utils/swapExecutor'
import { waitForConfirmedReceipt } from '@/utils/waitForConfirmedReceipt'

export const SWAP_STEPS = {
  QUOTE: 0,
  NETWORK: 1,
  APPROVE: 2,
  SWAP: 3,
} as const

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
  quote: SwapData | null
  awaitingAcceptance: boolean
  acceptQuote: () => void
  cancelQuote: () => void
}

export const useSwapExecution = (
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  swapData: SwapData | null
): UseSwapExecutionResult => {
  const ctx = useToolExecution(toolCallId, 'initiateSwapTool', {})
  const [awaitingAcceptance, setAwaitingAcceptance] = useState(false)
  const confirmation = useRef<((accepted: boolean) => void) | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      confirmation.current?.(false)
      confirmation.current = null
    }
  }, [])
  const answer = (accepted: boolean) => {
    confirmation.current?.(accepted)
    confirmation.current = null
    setAwaitingAcceptance(false)
  }

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

        const assertWallet = () => {
          if (!mounted.current) throw new Error('Swap view closed. Please start again.')
          for (const [asset, account] of [
            [data.swapData.sellAsset, data.swapData.sellAccount],
            [data.swapData.buyAsset, data.swapData.buyAccount],
          ] as const) {
            const address =
              fromChainId(asset.chainId).chainNamespace === CHAIN_NAMESPACE.Evm
                ? ctx.refs.evmAddress.current
                : ctx.refs.solanaAddress.current
            const matches =
              address &&
              (asset.chainId.startsWith('eip155:')
                ? address.toLowerCase() === account.toLowerCase()
                : address === account)
            if (!matches) throw new Error('Wallet changed or disconnected. Please re-initiate the swap.')
          }
        }
        assertWallet()

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

        // Refresh after the wallet lock/network switch, then again after any approval.
        let hadApproval = false
        data = await prepareFreshSwap(data, {
          assertWallet,
          refresh: async quote => {
            ctx.setSubstatus('Refreshing swap quote...')
            return refreshSwapQuote(quote)
          },
          show: quote =>
            ctx.setState(draft => {
              draft.toolOutput = quote
            }),
          confirm: () => {
            ctx.setSubstatus('Review updated quote')
            setAwaitingAcceptance(true)
            return new Promise<boolean>(resolve => {
              confirmation.current = resolve
            })
          },
          approve: async quote => {
            ctx.setSubstatus('Checking allowance...')
            const swap = quote.swapData
            const approvalTxHash = await ensureAllowance({
              sellAssetId: swap.sellAsset.assetId,
              sellAssetChainId,
              sellAssetPrecision: swap.sellAsset.precision,
              approvalTarget: swap.approvalTarget,
              sellAmountCryptoPrecision: swap.sellAmountCryptoPrecision,
              sellAccount: swap.sellAccount,
              solanaSigner,
              beforeSign: () => {
                assertWallet()
                assertQuoteFresh(quote)
              },
            })
            if (!approvalTxHash) return false
            hadApproval = true
            ctx.setMeta({ approvalTxHash })
            if (chainNamespace === CHAIN_NAMESPACE.Evm) {
              ctx.setSubstatus('Waiting for approval confirmation...')
              await waitForConfirmedReceipt(Number(chainReference), approvalTxHash as `0x${string}`)
            }
            return true
          },
        })
        if (hadApproval) ctx.advanceStep()
        else ctx.skipStep()

        ctx.setSubstatus('Requesting signature...')
        const swapTxHash = await executeSwap(data.swapTx, {
          solanaSigner,
          beforeSign: () => {
            assertWallet()
            assertQuoteFresh(data)
          },
        })
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
    quote: (ctx.state.toolOutput as SwapData | undefined) ?? swapData,
    awaitingAcceptance,
    acceptQuote: () => answer(true),
    cancelQuote: () => answer(false),
    steps: [
      { step: SWAP_STEPS.QUOTE, status: quoteStepStatus },
      {
        step: SWAP_STEPS.NETWORK,
        status: getStepStatus(SWAP_STEPS.NETWORK, ctx.state),
      },
      {
        step: SWAP_STEPS.APPROVE,
        status: getStepStatus(SWAP_STEPS.APPROVE, ctx.state),
      },
      {
        step: SWAP_STEPS.SWAP,
        status: getStepStatus(SWAP_STEPS.SWAP, ctx.state),
      },
    ],
    networkName: swapData?.swapData?.sellAsset?.network,
    error: ctx.state.error,
    approvalTxHash: ctx.state.meta.approvalTxHash,
    swapTxHash: ctx.state.meta.txHash,
  }
}
