import type { CreateLimitOrderOutput } from '@shapeshiftoss/agentic-server'
import { useChatStore } from '@shapeshiftoss/chat'
import { ExternalLink } from 'lucide-react'

import { useLimitOrderExecution } from '@/hooks/useLimitOrderExecution'
import { StepStatus } from '@/hooks/useSwapExecution'

import { Amount } from '../ui/Amount'
import { Skeleton } from '../ui/Skeleton'
import { TruncateText } from '../ui/TruncateText'
import { TxStepCard } from '../ui/TxStepCard'

import type { ToolUIComponentProps } from './toolUIHelpers'

export function LimitOrderUI({ toolPart }: ToolUIComponentProps) {
  const { state, output, toolCallId } = toolPart
  const orderOutput = output as CreateLimitOrderOutput | undefined
  const { isHistorical, getPersistedTransaction } = useChatStore()

  const orderData = state === 'output-available' && orderOutput ? orderOutput : null
  const { error, steps, networkName, trackingUrl, orderId } = useLimitOrderExecution(toolCallId, state, orderData)
  const needsApproval = orderOutput?.needsApproval ?? false

  const isHistoricalSkipped = isHistorical(toolCallId) && !getPersistedTransaction(toolCallId)

  if (isHistoricalSkipped) {
    return (
      <TxStepCard.Root>
        <div className="text-sm text-muted-foreground font-medium p-4">
          Limit order execution skipped (no saved data)
        </div>
      </TxStepCard.Root>
    )
  }

  const [prepareStep, networkStep, approvalStep, approvalConfirmStep, signStep, submitStep] = steps
  if (!prepareStep || !networkStep || !approvalStep || !approvalConfirmStep || !signStep || !submitStep) {
    return (
      <TxStepCard.Root>
        <div className="text-sm text-muted-foreground font-medium p-4">
          Unable to load limit order steps. Please try again.
        </div>
      </TxStepCard.Root>
    )
  }

  const completedCount = [
    prepareStep.status,
    networkStep.status,
    approvalStep.status,
    approvalConfirmStep.status,
    signStep.status,
    submitStep.status,
  ].filter(s => s === StepStatus.COMPLETE || s === StepStatus.SKIPPED).length

  const footerMessage = (() => {
    if (state === 'output-error') return { type: 'error' as const, text: 'Failed to prepare limit order' }
    if (error) return { type: 'error' as const, text: `Limit order failed: ${error}` }
    return null
  })()

  const summary = orderOutput?.summary
  const hasError = state === 'output-error'
  const isLoading = !summary && !hasError

  return (
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
              value={<Amount.Crypto value={summary.sellAsset.amount} symbol={summary.sellAsset.symbol.toUpperCase()} />}
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

      <TxStepCard.Stepper completedCount={completedCount} totalCount={6}>
        <TxStepCard.Step status={prepareStep.status} connectorBottom>
          Preparing limit order
        </TxStepCard.Step>
        <TxStepCard.Step status={networkStep.status} connectorTop connectorBottom>
          {networkName ? `Switch to ${networkName}` : 'Switch network'}
        </TxStepCard.Step>
        <TxStepCard.Step status={needsApproval ? approvalStep.status : StepStatus.SKIPPED} connectorTop connectorBottom>
          Approve token for CoW
        </TxStepCard.Step>
        <TxStepCard.Step
          status={needsApproval ? approvalConfirmStep.status : StepStatus.SKIPPED}
          connectorTop
          connectorBottom
        >
          Confirming approval
        </TxStepCard.Step>
        <TxStepCard.Step status={signStep.status} connectorTop connectorBottom>
          Sign order message
        </TxStepCard.Step>
        <TxStepCard.Step status={submitStep.status} connectorTop>
          Submit to CoW Protocol
        </TxStepCard.Step>

        {orderId && trackingUrl && (
          <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-3"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View order on CoW Explorer
          </a>
        )}

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
