import type { SendOutput } from '@shapeshiftoss/agentic-server'
import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'
import { toast } from 'sonner'

import { Execution } from '@/components/Execution'
import { useExecuteOnce } from '@/hooks/useExecuteOnce'
import { useToolExecution } from '@/hooks/useToolExecution'
import { toolStateToStepStatus } from '@/lib/executionState'
import { analytics } from '@/lib/mixpanel'
import { withWalletLock } from '@/lib/walletMutex'
import { switchNetworkStep } from '@/lib/steps/switchNetworkStep'
import { firstFourLastFour } from '@/lib/utils'
import type { SolanaWalletSigner } from '@/utils/chains/types'
import { executeSend } from '@/utils/sendExecutor'

import { Amount } from '../ui/Amount'
import { Skeleton } from '../ui/Skeleton'
import { TxStepCard } from '../ui/TxStepCard'

import type { ToolUIComponentProps } from './toolUIHelpers'

const SEND_STEPS = { PREPARE: 0, NETWORK: 1, SEND: 2 } as const

export function SendUI({ toolPart }: ToolUIComponentProps<'sendTool'>) {
  const { state: toolState, output, toolCallId } = toolPart
  const sendOutput = output
  const address = sendOutput?.summary.from

  const sendData = toolState === 'output-available' && sendOutput ? sendOutput : null

  const ctx = useToolExecution(toolCallId, 'sendTool', {})

  useExecuteOnce(ctx, sendData, async (data: SendOutput, ctx) => {
    await withWalletLock(async () => {
    try {
      const { tx } = data

      if (!tx?.from) throw new Error('Invalid send output: missing tx.from')
      if (!tx?.chainId) throw new Error('Invalid send output: missing tx.chainId')
      if (!data.sendData?.chainId) throw new Error('Invalid send output: missing sendData.chainId')

      const assetChainId = data.sendData.chainId
      const { chainNamespace } = fromChainId(assetChainId)

      const currentAddress =
        chainNamespace === CHAIN_NAMESPACE.Evm ? ctx.refs.evmAddress.current : ctx.refs.solanaAddress.current
      if (!currentAddress) throw new Error('Wallet disconnected. Please reconnect and try again.')
      if (currentAddress.toLowerCase() !== tx.from.toLowerCase()) {
        throw new Error('Wallet address changed. Please re-initiate the transaction.')
      }

      let solanaSigner: SolanaWalletSigner | undefined
      if (chainNamespace === CHAIN_NAMESPACE.Solana && ctx.refs.solanaWallet.current) {
        solanaSigner = await ctx.refs.solanaWallet.current.getSigner()
      }

      ctx.setState(draft => {
        draft.toolOutput = data
        draft.meta.networkName = data.sendData.asset.network
      })
      ctx.advanceStep()

      await switchNetworkStep(ctx, assetChainId)

      ctx.setSubstatus('Requesting signature...')
      const sendTxHash = await executeSend(tx, { solanaSigner })
      ctx.setMeta({ txHash: sendTxHash })
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
      ctx.failAndPersist(error)

      toast.error(`Send of ${data.sendData.amount} ${data.sendData.asset.symbol.toUpperCase()} failed`)
    }
    })
  })

  const prepareStepStatus = toolStateToStepStatus(toolState)

  const networkName = sendData?.sendData?.asset?.network

  const hasError = toolState === 'output-error'
  const isLoading = !sendOutput && !hasError

  const summary = sendOutput?.summary

  return (
    <Execution.Root state={ctx.state} toolCallId={toolCallId}>
      <Execution.HistoricalGuard fallbackLabel="Send">
        <TxStepCard.Root>
          <TxStepCard.Header>
            <TxStepCard.HeaderRow>
              {address && (
                <div className="text-xs text-muted-foreground font-normal">Sent from {firstFourLastFour(address)}</div>
              )}
              <div className="text-sm text-muted-foreground font-normal">
                {summary?.estimatedFeeUsd ? (
                  <Amount.Fiat value={summary.estimatedFeeUsd} />
                ) : isLoading ? (
                  <Skeleton className="h-5 w-16" />
                ) : (
                  <>—</>
                )}
              </div>
            </TxStepCard.HeaderRow>
            <TxStepCard.HeaderRow>
              {summary ? (
                <div className="text-lg font-semibold">Send {summary.asset}</div>
              ) : (
                <Skeleton className="h-7 w-40" />
              )}
              <TxStepCard.Amount value={summary?.amount} symbol={summary?.symbol} prefix="-" isLoading={!summary} />
            </TxStepCard.HeaderRow>
          </TxStepCard.Header>

          {summary && (
            <TxStepCard.Content>
              <TxStepCard.Details>
                <TxStepCard.DetailItem label="From" value={summary.from} />
                <TxStepCard.DetailItem label="To" value={summary.to} />
                <TxStepCard.DetailItem label="Amount" value={summary.asset} />
                <TxStepCard.DetailItem label="Network" value={summary.chainName} />
                <TxStepCard.DetailItem
                  label="Estimated Fee"
                  value={<Amount.Crypto value={summary.estimatedFeeCrypto} symbol={summary.estimatedFeeSymbol} />}
                />
                {summary.ataCreation && (
                  <TxStepCard.DetailItem
                    label="Note"
                    value="Will create recipient token account (~0.002 SOL)"
                    className="text-amber-600"
                  />
                )}
              </TxStepCard.Details>
            </TxStepCard.Content>
          )}

          <Execution.Stepper>
            <Execution.Step
              index={SEND_STEPS.PREPARE}
              label="Preparing send transaction"
              overrideStatus={prepareStepStatus}
              connectorBottom
            />
            <Execution.Step
              index={SEND_STEPS.NETWORK}
              label={networkName ? `Switch to ${networkName}` : 'Switch network'}
              connectorTop
              connectorBottom
            />
            <Execution.Step index={SEND_STEPS.SEND} label="Sign and send transaction" connectorTop />
          </Execution.Stepper>
          <Execution.ErrorFooter />
        </TxStepCard.Root>
      </Execution.HistoricalGuard>
    </Execution.Root>
  )
}
