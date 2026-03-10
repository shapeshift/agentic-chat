import { ExternalLink } from 'lucide-react'

import { Execution } from '@/components/Execution'
import { StepStatus } from '@/lib/stepUtils'

import { Amount } from '../ui/Amount'
import { Skeleton } from '../ui/Skeleton'
import { TxStepCard } from '../ui/TxStepCard'

import type { ToolUIComponentProps } from './toolUIHelpers'
import { LIMIT_ORDER_STEPS, useLimitOrderExecution } from './useLimitOrderExecution'

export function LimitOrderUI({ toolPart }: ToolUIComponentProps<'createLimitOrderTool'>) {
  const { state: toolState, output, toolCallId } = toolPart
  const orderOutput = output

  const orderData = toolState === 'output-available' && orderOutput ? orderOutput : null
  const { state, steps, networkName, trackingUrl, orderId } = useLimitOrderExecution(toolCallId, toolState, orderData)
  const needsApproval = orderOutput?.needsApproval ?? false

  const quoteStepStatus = steps[LIMIT_ORDER_STEPS.PREPARE]?.status ?? StepStatus.NOT_STARTED

  const summary = orderOutput?.summary
  const hasError = toolState === 'output-error'
  const isLoading = !summary && !hasError

  return (
    <Execution.Root state={state} toolCallId={toolCallId}>
      <Execution.HistoricalGuard fallbackLabel="Limit order">
        <TxStepCard.Root>
          <TxStepCard.Header>
            <TxStepCard.HeaderRow>
              <div className="text-xs text-muted-foreground font-normal">Limit Order</div>
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
                value={summary?.buyAsset.estimatedAmount}
                symbol={summary?.buyAsset.symbol.toUpperCase()}
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
                  value={
                    <Amount.Crypto value={summary.sellAsset.amount} symbol={summary.sellAsset.symbol.toUpperCase()} />
                  }
                />
                <TxStepCard.DetailItem
                  label="Buy Amount"
                  value={
                    <Amount.Crypto
                      value={summary.buyAsset.estimatedAmount}
                      symbol={summary.buyAsset.symbol.toUpperCase()}
                    />
                  }
                />
                <TxStepCard.DetailItem
                  label="Limit Price"
                  value={`1 ${summary.sellAsset.symbol.toUpperCase()} = ${summary.limitPrice} ${summary.buyAsset.symbol.toUpperCase()}`}
                />
                <TxStepCard.DetailItem label="Expires" value={new Date(summary.expiresAt).toLocaleString()} />
                <TxStepCard.DetailItem label="Provider" value={summary.provider.toUpperCase()} />
              </TxStepCard.Details>
            </TxStepCard.Content>
          )}

          <Execution.Stepper>
            <Execution.Step
              index={LIMIT_ORDER_STEPS.PREPARE}
              label="Preparing limit order"
              overrideStatus={quoteStepStatus}
              connectorBottom
            />
            <Execution.Step
              index={LIMIT_ORDER_STEPS.NETWORK}
              label={networkName ? `Switch to ${networkName}` : 'Switch network'}
              connectorTop
              connectorBottom
            />
            <Execution.Step
              index={LIMIT_ORDER_STEPS.APPROVE}
              label="Approve token for CoW"
              overrideStatus={!needsApproval ? StepStatus.SKIPPED : undefined}
              connectorTop
              connectorBottom
            />
            <Execution.Step index={LIMIT_ORDER_STEPS.SIGN} label="Sign order message" connectorTop connectorBottom />
            <Execution.Step index={LIMIT_ORDER_STEPS.SUBMIT} label="Submit to CoW Protocol" connectorTop />
          </Execution.Stepper>

          {orderId && trackingUrl && (
            <a
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-3 px-4 pb-4"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View order on CoW Explorer
            </a>
          )}

          <Execution.ErrorFooter />
        </TxStepCard.Root>
      </Execution.HistoricalGuard>
    </Execution.Root>
  )
}
