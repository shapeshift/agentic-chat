import { Execution } from '@/components/Execution'
import { SWAP_STEPS, useSwapExecution } from '@/hooks/useSwapExecution'
import { bnOrZero } from '@/lib/bignumber'
import { StepStatus } from '@/lib/stepUtils'
import { firstFourLastFour } from '@/lib/utils'

import { Amount } from '../ui/Amount'
import { Skeleton } from '../ui/Skeleton'
import { TxStepCard } from '../ui/TxStepCard'

import type { ToolUIComponentProps } from './toolUIHelpers'

export function InitiateSwapUI({ toolPart }: ToolUIComponentProps<'initiateSwapTool' | 'initiateSwapUsdTool'>) {
  const { state: toolState, output, toolCallId } = toolPart
  const swapOutput = output
  const address = swapOutput?.swapData.sellAccount

  const swapData = toolState === 'output-available' && swapOutput ? swapOutput : null
  const { state, steps, networkName } = useSwapExecution(toolCallId, toolState, swapData)

  const quoteStepStatus = steps[SWAP_STEPS.QUOTE]?.status ?? StepStatus.NOT_STARTED

  const swap = swapOutput?.swapData
  const buyAmount = swap ? bnOrZero(swap.buyAmountCryptoPrecision) : bnOrZero(0)
  const sellAmount = swap ? bnOrZero(swap.sellAmountCryptoPrecision) : bnOrZero(0)
  const rate = buyAmount.gt(0) && sellAmount.gt(0) ? buyAmount.div(sellAmount).toFixed(6) : '—'

  const hasError = toolState === 'output-error'
  const isLoading = !swap && !hasError

  const UsdValue = () => {
    if (swap?.buyAmountUsd) return <Amount.Fiat value={swap.buyAmountUsd} />
    if (isLoading) return <Skeleton className="h-5 w-16" />
    return <>—</>
  }

  return (
    <Execution.Root state={state} toolCallId={toolCallId}>
      <Execution.HistoricalGuard fallbackLabel="Swap">
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

          <Execution.Stepper>
            <Execution.Step index={SWAP_STEPS.QUOTE} label="Getting swap quote" overrideStatus={quoteStepStatus} connectorBottom />
            <Execution.Step index={SWAP_STEPS.NETWORK} label={networkName ? `Switch to ${networkName}` : 'Switch network'} connectorTop connectorBottom />
            <Execution.Step index={SWAP_STEPS.APPROVE} label="Approve token spending" connectorTop connectorBottom />
            <Execution.Step index={SWAP_STEPS.SWAP} label="Sign swap transaction" connectorTop />
          </Execution.Stepper>
          <Execution.ErrorFooter />
        </TxStepCard.Root>
      </Execution.HistoricalGuard>
    </Execution.Root>
  )
}
