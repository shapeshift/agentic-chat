import { useAppKitAccount } from '@reown/appkit/react'
import type { InitiateSwapOutput } from '@shapeshiftoss/agentic-server'

import { StepStatus, useSwapExecution } from '@/hooks/useSwapExecution'
import { firstFourLastFour } from '@/lib/utils'
import { useToolExecutionStore } from '@/stores/toolExecutionStore'

import { Skeleton } from '../ui/skeleton'
import { TxStepCard } from '../ui/TxStepCard'

import type { ToolUIComponentProps } from './toolUIHelpers'

export function InitiateSwapUI({ toolPart }: ToolUIComponentProps) {
  const { state, output, toolCallId } = toolPart
  const swapOutput = output as InitiateSwapOutput | undefined
  const { isHistorical, getPersistedState } = useToolExecutionStore()
  const { address } = useAppKitAccount()

  const swapData = state === 'output-available' && swapOutput ? swapOutput : null
  const { error, steps, networkName } = useSwapExecution(toolCallId, state, swapData)

  const isHistoricalSkipped = isHistorical(toolCallId) && !getPersistedState(toolCallId)

  if (isHistoricalSkipped) {
    return (
      <TxStepCard.Root>
        <div className="text-sm text-muted-foreground font-medium p-4">⏭️ Swap execution skipped (no saved data)</div>
      </TxStepCard.Root>
    )
  }

  const [quoteStep, networkStep, approvalStep, swapStep] = steps
  if (!quoteStep || !networkStep || !approvalStep || !swapStep) {
    return (
      <TxStepCard.Root>
        <div className="text-sm text-muted-foreground font-medium p-4">
          ⚠️ Unable to load swap steps. Please try again.
        </div>
      </TxStepCard.Root>
    )
  }

  const completedCount = [quoteStep.status, networkStep.status, approvalStep.status, swapStep.status].filter(
    s => s === StepStatus.COMPLETE || s === StepStatus.SKIPPED
  ).length

  const footerMessage = (() => {
    if (state === 'output-error') return { type: 'error' as const, text: 'Failed to get swap quote' }
    if (error) return { type: 'error' as const, text: `Swap execution failed: ${error}` }
    return null
  })()

  const swap = swapOutput?.swapData
  const buyAmount = swap ? Number(swap.buyAmountCryptoPrecision) : 0
  const sellAmount = swap ? Number(swap.sellAmountCryptoPrecision) : 0
  const rate = buyAmount > 0 && sellAmount > 0 ? (buyAmount / sellAmount).toFixed(6) : '—'

  return (
    <TxStepCard.Root>
      <TxStepCard.Header>
        <TxStepCard.HeaderRow>
          {address && (
            <div className="text-xs text-muted-foreground font-normal">Received from {firstFourLastFour(address)}</div>
          )}
          <div className="text-sm text-muted-foreground font-normal">
            {swap?.buyAmountUsd ? `$${swap.buyAmountUsd}` : <Skeleton className="h-5 w-16" />}
          </div>
        </TxStepCard.HeaderRow>
        <TxStepCard.HeaderRow>
          {swap ? (
            <TxStepCard.SwapPair
              fromSymbol={swap.sellAsset.symbol.toUpperCase()}
              toSymbol={swap.buyAsset.symbol.toUpperCase()}
            />
          ) : (
            <Skeleton className="h-7 w-40" />
          )}
          {swap ? (
            <TxStepCard.Amount>
              +{Number(swap.buyAmountCryptoPrecision).toFixed(6)} {swap.buyAsset.symbol.toUpperCase()}
            </TxStepCard.Amount>
          ) : (
            <Skeleton className="h-7 w-32" />
          )}
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
              value={`${buyAmount.toFixed(8)} ${swap.buyAsset.symbol.toUpperCase()}`}
            />
            <TxStepCard.DetailItem
              label="Sell Amount"
              value={`${sellAmount.toFixed(8)} ${swap.sellAsset.symbol.toUpperCase()}`}
            />
            <TxStepCard.DetailItem
              label="Rate"
              value={`1 ${swap.sellAsset.symbol.toUpperCase()} = ${rate} ${swap.buyAsset.symbol.toUpperCase()}`}
            />
            <TxStepCard.DetailItem
              label="Network Fees"
              value={
                swapOutput?.summary.exchange.networkFeeCrypto && swapOutput?.summary.exchange.networkFeeUsd ? (
                  `${swapOutput.summary.exchange.networkFeeCrypto} ${swapOutput.summary.exchange.networkFeeSymbol} ($${swapOutput.summary.exchange.networkFeeUsd})`
                ) : (
                  <Skeleton className="h-4 w-20" />
                )
              }
            />
          </TxStepCard.Details>
        </TxStepCard.Content>
      )}

      <TxStepCard.Stepper completedCount={completedCount} totalCount={4}>
        <TxStepCard.Step status={quoteStep.status} connectorBottom>
          Getting swap quote
        </TxStepCard.Step>
        <TxStepCard.Step status={networkStep.status} connectorTop connectorBottom>
          {networkName ? `Switch to ${networkName}` : 'Switch network'}
        </TxStepCard.Step>
        <TxStepCard.Step status={approvalStep.status} connectorTop connectorBottom>
          Approve token spending
        </TxStepCard.Step>
        <TxStepCard.Step status={swapStep.status} connectorTop>
          Sign swap transaction
        </TxStepCard.Step>
        {footerMessage && (
          <div
            className={`text-sm font-medium mt-4 ${footerMessage.type === 'error' ? 'text-red-500' : 'text-muted-foreground'}`}
          >
            {footerMessage.text}
          </div>
        )}
      </TxStepCard.Stepper>
    </TxStepCard.Root>
  )
}
