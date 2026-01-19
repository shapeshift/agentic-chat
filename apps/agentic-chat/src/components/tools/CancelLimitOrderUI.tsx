import type { CancelLimitOrderOutput } from '@shapeshiftoss/agentic-server'
import { useChatStore } from '@shapeshiftoss/chat'
import { ExternalLink, XCircle } from 'lucide-react'

import { useCancelLimitOrderExecution } from '@/hooks/useCancelLimitOrderExecution'
import { StepStatus } from '@/hooks/useSwapExecution'

import { TruncateText } from '../ui/TruncateText'
import { TxStepCard } from '../ui/TxStepCard'

import type { ToolUIComponentProps } from './toolUIHelpers'

export function CancelLimitOrderUI({ toolPart }: ToolUIComponentProps) {
  const { state, output, toolCallId } = toolPart
  const cancelOutput = output as CancelLimitOrderOutput | undefined
  const { isHistorical, getPersistedTransaction } = useChatStore()

  const cancelData = state === 'output-available' && cancelOutput ? cancelOutput : null
  const { error, steps, networkName, trackingUrl, orderId } = useCancelLimitOrderExecution(
    toolCallId,
    state,
    cancelData
  )

  const isHistoricalSkipped = isHistorical(toolCallId) && !getPersistedTransaction(toolCallId)

  if (isHistoricalSkipped) {
    return (
      <TxStepCard.Root>
        <div className="text-sm text-muted-foreground font-medium p-4">Cancellation skipped (no saved data)</div>
      </TxStepCard.Root>
    )
  }

  const [prepareStep, networkStep, signStep, submitStep] = steps
  if (!prepareStep || !networkStep || !signStep || !submitStep) {
    return (
      <TxStepCard.Root>
        <div className="text-sm text-muted-foreground font-medium p-4">
          Unable to load cancellation steps. Please try again.
        </div>
      </TxStepCard.Root>
    )
  }

  const completedCount = [prepareStep.status, networkStep.status, signStep.status, submitStep.status].filter(
    s => s === StepStatus.COMPLETE || s === StepStatus.SKIPPED
  ).length

  const footerMessage = (() => {
    if (state === 'output-error') return { type: 'error' as const, text: 'Failed to prepare cancellation' }
    if (error) return { type: 'error' as const, text: `Cancellation failed: ${error}` }
    return null
  })()

  const isComplete = submitStep.status === StepStatus.COMPLETE

  return (
    <TxStepCard.Root>
      <TxStepCard.Header>
        <TxStepCard.HeaderRow>
          <div className="text-xs text-muted-foreground font-normal">Cancel Limit Order</div>
          {networkName && <div className="text-sm text-muted-foreground font-normal capitalize">{networkName}</div>}
        </TxStepCard.HeaderRow>
        <TxStepCard.HeaderRow>
          <div className="flex items-center gap-2">
            <XCircle className={`h-5 w-5 ${isComplete ? 'text-green-500' : 'text-red-500'}`} />
            <span className="text-lg font-semibold">{isComplete ? 'Order Cancelled' : 'Cancelling Order'}</span>
          </div>
        </TxStepCard.HeaderRow>
      </TxStepCard.Header>

      {orderId && (
        <TxStepCard.Content>
          <TxStepCard.Details>
            <TxStepCard.DetailItem
              label="Order ID"
              value={
                <span className="font-mono text-xs">
                  {orderId.slice(0, 10)}...{orderId.slice(-8)}
                </span>
              }
            />
            <TxStepCard.DetailItem label="Network" value={<span className="capitalize">{networkName}</span>} />
          </TxStepCard.Details>
        </TxStepCard.Content>
      )}

      <TxStepCard.Stepper completedCount={completedCount} totalCount={4}>
        <TxStepCard.Step status={prepareStep.status} connectorBottom>
          Preparing cancellation
        </TxStepCard.Step>
        <TxStepCard.Step status={networkStep.status} connectorTop connectorBottom>
          {networkName ? `Switch to ${networkName}` : 'Switch network'}
        </TxStepCard.Step>
        <TxStepCard.Step status={signStep.status} connectorTop connectorBottom>
          Sign cancellation message
        </TxStepCard.Step>
        <TxStepCard.Step status={submitStep.status} connectorTop>
          Submit to CoW Protocol
        </TxStepCard.Step>

        {trackingUrl && (
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
