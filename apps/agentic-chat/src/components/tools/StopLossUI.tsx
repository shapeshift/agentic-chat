import { ExternalLink } from 'lucide-react'

import { Execution } from '@/components/Execution'
import { CONDITIONAL_ORDER_STEPS, useStopLossExecution } from '@/hooks/useStopLossExecution'
import { getExplorerUrl, getSafeAppUrl } from '@/lib/explorers'
import { StepStatus } from '@/lib/stepUtils'

import { Amount } from '../ui/Amount'
import { Skeleton } from '../ui/Skeleton'
import { TxStepCard } from '../ui/TxStepCard'

import type { ToolUIComponentProps } from './toolUIHelpers'

export function StopLossUI({ toolPart }: ToolUIComponentProps<'createStopLossTool'>) {
  const { state: toolState, output, toolCallId } = toolPart
  const orderOutput = output

  const orderData = toolState === 'output-available' && orderOutput ? orderOutput : null
  const { state, steps, networkName, submitTxHash } = useStopLossExecution(toolCallId, toolState, orderData)

  const needsDeposit = orderOutput?.needsDeposit ?? false
  const needsApproval = orderOutput?.needsApproval ?? false
  const summary = orderOutput?.summary
  const sellSymbol = summary?.sellAsset.symbol.toUpperCase()
  const sellAmount = summary?.sellAsset.amount

  const prepareStepStatus = steps[CONDITIONAL_ORDER_STEPS.PREPARE]?.status ?? StepStatus.NOT_STARTED

  const hasError = toolState === 'output-error'
  const isLoading = !summary && !hasError

  const depositLabel =
    sellAmount && sellSymbol ? `Depositing ${sellAmount} ${sellSymbol} to vault` : 'Depositing tokens to vault'
  const approvalLabel = sellSymbol ? `Approving ${sellSymbol} for trading` : 'Approving token for trading'

  return (
    <Execution.Root state={state} toolCallId={toolCallId}>
      <Execution.HistoricalGuard fallbackLabel="Stop-loss">
        <TxStepCard.Root>
          <TxStepCard.Header>
            <TxStepCard.HeaderRow>
              <div className="text-xs text-muted-foreground font-normal">Stop-Loss Order</div>
              <div className="text-sm text-muted-foreground font-normal">
                {summary
                  ? `Expires ${new Date(summary.expiresAt).toLocaleDateString()}`
                  : isLoading && <Skeleton className="h-4 w-20" />}
              </div>
            </TxStepCard.HeaderRow>
            <TxStepCard.HeaderRow>
              <TxStepCard.SwapPair
                fromSymbol={summary?.sellAsset.symbol.toUpperCase()}
                toSymbol={summary?.buyAsset.symbol.toUpperCase()}
                isLoading={isLoading}
              />
              <TxStepCard.Amount
                value={summary?.sellAsset.amount}
                symbol={summary?.sellAsset.symbol.toUpperCase()}
                isLoading={isLoading}
              />
            </TxStepCard.HeaderRow>
          </TxStepCard.Header>

          {summary && (
            <TxStepCard.Content>
              <TxStepCard.Details>
                <TxStepCard.DetailItem
                  label="Pair"
                  value={`${summary.sellAsset.symbol.toUpperCase()} → ${summary.buyAsset.symbol.toUpperCase()}`}
                />
                <TxStepCard.DetailItem
                  label="Sell Amount"
                  value={<Amount.Crypto value={summary.sellAsset.amount} symbol={summary.sellAsset.symbol.toUpperCase()} />}
                />
                <TxStepCard.DetailItem label="Trigger Price" value={`$${summary.triggerPrice}`} />
                <TxStepCard.DetailItem label="Current Price" value={`$${summary.currentPrice}`} />
                <TxStepCard.DetailItem label="Distance" value={`${summary.priceDistancePercent}% below current`} />
                <TxStepCard.DetailItem
                  label="Est. Receive"
                  value={
                    <Amount.Crypto
                      value={summary.buyAsset.estimatedAmount}
                      symbol={summary.buyAsset.symbol.toUpperCase()}
                    />
                  }
                />
                <TxStepCard.DetailItem label="Expires" value={new Date(summary.expiresAt).toLocaleString()} />
                {orderOutput?.safeAddress && (
                  <TxStepCard.DetailItem
                    label="Safe Vault"
                    value={
                      <a
                        href={getSafeAppUrl(summary.network, orderOutput.safeAddress)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        {orderOutput.safeAddress.slice(0, 6)}...{orderOutput.safeAddress.slice(-4)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    }
                  />
                )}
                <TxStepCard.DetailItem label="Provider" value={summary.provider.toUpperCase()} />
              </TxStepCard.Details>
            </TxStepCard.Content>
          )}

          <Execution.Stepper>
            <Execution.Step
              index={CONDITIONAL_ORDER_STEPS.PREPARE}
              label="Preparing stop-loss order"
              overrideStatus={prepareStepStatus}
              connectorBottom
            />
            <Execution.Step
              index={CONDITIONAL_ORDER_STEPS.NETWORK}
              label={networkName ? `Switching to ${networkName}` : 'Switching network'}
              connectorTop
              connectorBottom
            />
            <Execution.Step
              index={CONDITIONAL_ORDER_STEPS.SAFE_CHECK}
              label="Setting up vault"
              connectorTop
              connectorBottom
            />
            <Execution.Step
              index={CONDITIONAL_ORDER_STEPS.DEPOSIT}
              label={depositLabel}
              overrideStatus={!needsDeposit ? StepStatus.SKIPPED : undefined}
              connectorTop
              connectorBottom
            />
            <Execution.Step
              index={CONDITIONAL_ORDER_STEPS.APPROVE}
              label={approvalLabel}
              overrideStatus={!needsApproval ? StepStatus.SKIPPED : undefined}
              connectorTop
              connectorBottom
            />
            <Execution.Step
              index={CONDITIONAL_ORDER_STEPS.SUBMIT}
              label="Submitting stop-loss order"
              connectorTop
            />
          </Execution.Stepper>

          {submitTxHash && networkName && (
            <a
              href={getExplorerUrl(networkName, submitTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-3 px-4 pb-4"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="font-mono text-xs">
                {submitTxHash.slice(0, 10)}...{submitTxHash.slice(-8)}
              </span>
            </a>
          )}

          <Execution.ErrorFooter />
        </TxStepCard.Root>
      </Execution.HistoricalGuard>
    </Execution.Root>
  )
}
