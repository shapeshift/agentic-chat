import type { InitiateSwapOutput } from '@shapeshiftoss/agentic-server'

import { StepStatus, useSwapExecution } from '@/hooks/useSwapExecution'
import { bnOrZero } from '@/lib/bignumber'
import { firstFourLastFour } from '@/lib/utils'
import { useChatStore } from '@/stores/chatStore'

import { Amount } from '../ui/Amount'
import { Skeleton } from '../ui/Skeleton'
import { TruncateText } from '../ui/TruncateText'
import { TxStepCard } from '../ui/TxStepCard'

import type { ToolUIComponentProps } from './toolUIHelpers'

export function InitiateSwapUI({ toolPart }: ToolUIComponentProps) {
  const { state, output, toolCallId } = toolPart
  const swapOutput = output as InitiateSwapOutput | undefined
  const { isHistorical, getPersistedTransaction } = useChatStore()
  const address = swapOutput?.swapData.sellAccount

  const swapData = state === 'output-available' && swapOutput ? swapOutput : null
  const { error, steps, networkName } = useSwapExecution(toolCallId, state, swapData)

  const isHistoricalSkipped = isHistorical(toolCallId) && !getPersistedTransaction(toolCallId)

  if (isHistoricalSkipped) {
    return (
      <TxStepCard.Root>
        <div className="text-sm text-muted-foreground font-medium p-4">Swap execution skipped (no saved data)</div>
      </TxStepCard.Root>
    )
  }

  const [quoteStep, networkStep, approvalStep, confirmationStep, swapStep] = steps
  if (!quoteStep || !networkStep || !approvalStep || !confirmationStep || !swapStep) {
    return (
      <TxStepCard.Root>
        <div className="text-sm text-muted-foreground font-medium p-4">
          Unable to load swap steps. Please try again.
        </div>
      </TxStepCard.Root>
    )
  }

  const completedCount = [
    quoteStep.status,
    networkStep.status,
    approvalStep.status,
    confirmationStep.status,
    swapStep.status,
  ].filter(s => s === StepStatus.COMPLETE || s === StepStatus.SKIPPED).length

  const footerMessage = (() => {
    if (state === 'output-error') return { type: 'error' as const, text: 'Failed to get swap quote' }
    if (error) return { type: 'error' as const, text: `Swap execution failed: ${error}` }
    return null
  })()

  const swap = swapOutput?.swapData
  const buyAmount = swap ? bnOrZero(swap.buyAmountCryptoPrecision) : bnOrZero(0)
  const sellAmount = swap ? bnOrZero(swap.sellAmountCryptoPrecision) : bnOrZero(0)
  const rate = buyAmount.gt(0) && sellAmount.gt(0) ? buyAmount.div(sellAmount).toFixed(6) : '—'

  const hasError = state === 'output-error'
  const isLoading = !swap && !hasError

  const UsdValue = () => {
    if (swap?.buyAmountUsd) return <Amount.Fiat value={swap.buyAmountUsd} />
    if (isLoading) return <Skeleton className="h-5 w-16" />
    return <>—</>
  }

  return (
    <TxStepCard.Root>
      <TxStepCard.Header>
        <TxStepCard.HeaderRow>
          {address && (
            <div className="text-xs text-muted-foreground font-normal">Received from {firstFourLastFour(address)}</div>
          )}
          <div className="text-sm text-muted-foreground font-normal">
            <UsdValue />
          </div>
        </TxStepCard.HeaderRow>
        <TxStepCard.HeaderRow>
          <TxStepCard.SwapPair
            fromSymbol={swap?.sellAsset.symbol.toUpperCase()}
            toSymbol={swap?.buyAsset.symbol.toUpperCase()}
            isLoading={isLoading}
          />
          <TxStepCard.Amount
            value={swap?.buyAmountCryptoPrecision}
            symbol={swap?.buyAsset.symbol.toUpperCase()}
            isLoading={isLoading}
          />
        </TxStepCard.HeaderRow>
      </TxStepCard.Header>

      {swap && (
        <TxStepCard.Content>
          <TxStepCard.Details>
            <TxStepCard.DetailItem
              label="Pair"
              value={`${swap.sellAsset.symbol.toUpperCase()} → ${swap.buyAsset.symbol.toUpperCase()}`}
            />
            <TxStepCard.DetailItem
              label="Buy Amount"
              value={<Amount.Crypto value={buyAmount} symbol={swap.buyAsset.symbol.toUpperCase()} />}
            />
            <TxStepCard.DetailItem
              label="Sell Amount"
              value={<Amount.Crypto value={sellAmount} symbol={swap.sellAsset.symbol.toUpperCase()} />}
            />
            <TxStepCard.DetailItem
              label="Rate"
              value={`1 ${swap.sellAsset.symbol.toUpperCase()} = ${rate} ${swap.buyAsset.symbol.toUpperCase()}`}
            />
            <TxStepCard.DetailItem
              label="Network Fees"
              value={
                swapOutput?.summary.exchange.networkFeeCrypto && swapOutput?.summary.exchange.networkFeeUsd ? (
                  <Amount.Crypto
                    value={swapOutput.summary.exchange.networkFeeCrypto}
                    symbol={swapOutput.summary.exchange.networkFeeSymbol}
                    suffix={
                      <>
                        (<Amount.Fiat value={swapOutput.summary.exchange.networkFeeUsd} />)
                      </>
                    }
                  />
                ) : (
                  <Skeleton className="h-4 w-20" />
                )
              }
            />
          </TxStepCard.Details>
        </TxStepCard.Content>
      )}

      <TxStepCard.Stepper completedCount={completedCount} totalCount={5}>
        <TxStepCard.Step status={quoteStep.status} connectorBottom>
          Getting swap quote
        </TxStepCard.Step>
        <TxStepCard.Step status={networkStep.status} connectorTop connectorBottom>
          {networkName ? `Switch to ${networkName}` : 'Switch network'}
        </TxStepCard.Step>
        <TxStepCard.Step status={approvalStep.status} connectorTop connectorBottom>
          Approve token spending
        </TxStepCard.Step>
        <TxStepCard.Step status={confirmationStep.status} connectorTop connectorBottom>
          Confirming approval
        </TxStepCard.Step>
        <TxStepCard.Step status={swapStep.status} connectorTop>
          Sign swap transaction
        </TxStepCard.Step>
        {footerMessage && (
          <TruncateText
            text={footerMessage.text}
            limit={80}
            className={`text-sm font-medium mt-4 ${footerMessage.type === 'error' ? 'text-red-500' : 'text-muted-foreground'}`}
          />
        )}
      </TxStepCard.Stepper>
    </TxStepCard.Root>
  )
}
