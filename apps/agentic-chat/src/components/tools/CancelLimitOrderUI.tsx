import { ExternalLink, XCircle } from 'lucide-react'

import { Execution } from '@/components/Execution'
import { StepStatus } from '@/lib/stepUtils'

import { TxStepCard } from '../ui/TxStepCard'

import type { ToolUIComponentProps } from './toolUIHelpers'
import { CANCEL_LIMIT_ORDER_STEPS, useCancelLimitOrderExecution } from './useCancelLimitOrderExecution'

export function CancelLimitOrderUI({ toolPart }: ToolUIComponentProps<'cancelLimitOrderTool'>) {
  const { state: toolState, output, toolCallId } = toolPart
  const cancelOutput = output

  const cancelData = toolState === 'output-available' && cancelOutput ? cancelOutput : null
  const { state, steps, networkName, trackingUrl, orderId } = useCancelLimitOrderExecution(
    toolCallId,
    toolState,
    cancelData
  )

  const prepareStepStatus = steps[CANCEL_LIMIT_ORDER_STEPS.PREPARE]?.status ?? StepStatus.NOT_STARTED
  const isComplete = steps[CANCEL_LIMIT_ORDER_STEPS.SUBMIT]?.status === StepStatus.COMPLETE

  return (
    <Execution.Root state={state} toolCallId={toolCallId}>
      <Execution.HistoricalGuard fallbackLabel="Cancellation">
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

          <Execution.Stepper>
            <Execution.Step
              index={CANCEL_LIMIT_ORDER_STEPS.PREPARE}
              label="Preparing cancellation"
              overrideStatus={prepareStepStatus}
              connectorBottom
            />
            <Execution.Step
              index={CANCEL_LIMIT_ORDER_STEPS.NETWORK}
              label={networkName ? `Switch to ${networkName}` : 'Switch network'}
              connectorTop
              connectorBottom
            />
            <Execution.Step
              index={CANCEL_LIMIT_ORDER_STEPS.SIGN}
              label="Sign cancellation message"
              connectorTop
              connectorBottom
            />
            <Execution.Step index={CANCEL_LIMIT_ORDER_STEPS.SUBMIT} label="Submit to CoW Protocol" connectorTop />
          </Execution.Stepper>

          {trackingUrl && (
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
