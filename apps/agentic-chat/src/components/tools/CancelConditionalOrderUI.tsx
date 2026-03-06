import type { DynamicToolUIPart } from 'ai'
import { ExternalLink } from 'lucide-react'

import type { CancelConditionalOrderData } from '@/hooks/useCancelConditionalOrderExecution'
import { useCancelConditionalOrderExecution } from '@/hooks/useCancelConditionalOrderExecution'
import { getExplorerUrl } from '@/lib/explorers'
import { StepStatus } from '@/lib/stepUtils'
import { useChatStore } from '@/stores/chatStore'

import { Skeleton } from '../ui/Skeleton'
import { TruncateText } from '../ui/TruncateText'
import { TxStepCard } from '../ui/TxStepCard'

const CHAIN_ID_TO_NETWORK: Record<number, string> = { 1: 'ethereum', 100: 'gnosis', 42161: 'arbitrum' }

interface CancelConditionalOrderUIProps {
  toolCallId: string
  state: DynamicToolUIPart['state']
  cancelOutput: CancelConditionalOrderData | undefined
  toolType: 'cancel_stop_loss' | 'cancel_twap'
  orderLabel: string
  headerLabel: string
}

export function CancelConditionalOrderUI({
  toolCallId,
  state,
  cancelOutput,
  toolType,
  orderLabel,
  headerLabel,
}: CancelConditionalOrderUIProps) {
  const { isHistorical, getPersistedTransaction } = useChatStore()

  const cancelData = state === 'output-available' && cancelOutput ? cancelOutput : null
  const { error, steps, cancelTxHash } = useCancelConditionalOrderExecution(
    toolCallId,
    state,
    cancelData,
    toolType,
    orderLabel
  )

  const isHistoricalSkipped = isHistorical(toolCallId) && !getPersistedTransaction(toolCallId)

  if (isHistoricalSkipped) {
    return (
      <TxStepCard.Root>
        <div className="text-sm text-muted-foreground font-medium p-4">Cancel execution skipped (no saved data)</div>
      </TxStepCard.Root>
    )
  }

  const [prepareStep, networkStep, submitStep, confirmStep] = steps
  if (!prepareStep || !networkStep || !submitStep || !confirmStep) {
    return (
      <TxStepCard.Root>
        <div className="text-sm text-muted-foreground font-medium p-4">
          Unable to load cancellation steps. Please try again.
        </div>
      </TxStepCard.Root>
    )
  }

  const completedCount = [prepareStep.status, networkStep.status, submitStep.status, confirmStep.status].filter(
    s => s === StepStatus.COMPLETE || s === StepStatus.SKIPPED
  ).length

  const footerMessage = (() => {
    if (state === 'output-error') return { type: 'error' as const, text: 'Failed to prepare cancellation' }
    if (error) return { type: 'error' as const, text: `Cancellation failed: ${error}` }
    return null
  })()

  const hasError = state === 'output-error'
  const isLoading = !cancelOutput && !hasError

  return (
    <TxStepCard.Root>
      <TxStepCard.Header>
        <TxStepCard.HeaderRow>
          <div className="text-xs text-muted-foreground font-normal">{headerLabel}</div>
          {isLoading && <Skeleton className="h-4 w-20" />}
        </TxStepCard.HeaderRow>
      </TxStepCard.Header>

      {cancelOutput && (
        <TxStepCard.Content>
          <TxStepCard.Details>
            <TxStepCard.DetailItem
              label="Order Hash"
              value={`${cancelOutput.orderHash.slice(0, 10)}...${cancelOutput.orderHash.slice(-8)}`}
            />
            <TxStepCard.DetailItem
              label="Safe"
              value={`${cancelOutput.safeAddress.slice(0, 6)}...${cancelOutput.safeAddress.slice(-4)}`}
            />
          </TxStepCard.Details>
        </TxStepCard.Content>
      )}

      <TxStepCard.Stepper completedCount={completedCount} totalCount={steps.length}>
        <TxStepCard.Step status={prepareStep.status} connectorBottom>
          Preparing cancellation
        </TxStepCard.Step>
        <TxStepCard.Step status={networkStep.status} connectorTop connectorBottom>
          Switch network
        </TxStepCard.Step>
        <TxStepCard.Step status={submitStep.status} connectorTop connectorBottom>
          Submit cancel via Safe
        </TxStepCard.Step>
        <TxStepCard.Step status={confirmStep.status} connectorTop>
          Confirming on-chain
        </TxStepCard.Step>

        {cancelTxHash && cancelOutput && (
          <a
            href={getExplorerUrl(CHAIN_ID_TO_NETWORK[cancelOutput.safeTransaction.chainId] ?? 'ethereum', cancelTxHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-3"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="font-mono text-xs">
              {cancelTxHash.slice(0, 10)}...{cancelTxHash.slice(-8)}
            </span>
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
