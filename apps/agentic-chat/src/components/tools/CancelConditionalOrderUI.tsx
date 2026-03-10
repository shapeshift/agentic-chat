import { ExternalLink } from 'lucide-react'

import { Execution } from '@/components/Execution'
import { getExplorerUrl } from '@/lib/explorers'
import { StepStatus } from '@/lib/stepUtils'

import { TxStepCard } from '../ui/TxStepCard'

import { CANCEL_CONDITIONAL_STEPS, useCancelConditionalOrderExecution } from './useCancelConditionalOrderExecution'
import type { CancelConditionalOrderConfig, CancelConditionalOrderData } from './useCancelConditionalOrderExecution'

const CHAIN_ID_TO_NETWORK: Record<number, string> = { 1: 'ethereum', 100: 'gnosis', 42161: 'arbitrum' }

interface CancelConditionalOrderUIProps {
  toolCallId: string
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
  cancelOutput: CancelConditionalOrderData | undefined
  config: CancelConditionalOrderConfig
  headerLabel: string
}

export function CancelConditionalOrderUI({
  toolCallId,
  state: toolState,
  cancelOutput,
  config,
  headerLabel,
}: CancelConditionalOrderUIProps) {
  const cancelData = toolState === 'output-available' && cancelOutput ? cancelOutput : null
  const { state, steps, cancelTxHash } = useCancelConditionalOrderExecution(toolCallId, toolState, cancelData, config)

  const prepareStepStatus = steps[CANCEL_CONDITIONAL_STEPS.PREPARE]?.status ?? StepStatus.NOT_STARTED

  return (
    <Execution.Root state={state} toolCallId={toolCallId}>
      <Execution.HistoricalGuard fallbackLabel={`Cancel ${config.orderLabel}`}>
        <TxStepCard.Root>
          <TxStepCard.Header>
            <TxStepCard.HeaderRow>
              <div className="text-xs text-muted-foreground font-normal">{headerLabel}</div>
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

          <Execution.Stepper>
            <Execution.Step
              index={CANCEL_CONDITIONAL_STEPS.PREPARE}
              label="Preparing cancellation"
              overrideStatus={prepareStepStatus}
              connectorBottom
            />
            <Execution.Step
              index={CANCEL_CONDITIONAL_STEPS.NETWORK}
              label="Switch network"
              connectorTop
              connectorBottom
            />
            <Execution.Step
              index={CANCEL_CONDITIONAL_STEPS.SUBMIT_CANCEL}
              label="Submit cancel via Safe"
              connectorTop
              connectorBottom
            />
            <Execution.Step index={CANCEL_CONDITIONAL_STEPS.CONFIRM_TX} label="Confirming on-chain" connectorTop />
          </Execution.Stepper>

          {cancelTxHash && cancelOutput && (
            <a
              href={getExplorerUrl(
                CHAIN_ID_TO_NETWORK[cancelOutput.safeTransaction.chainId] ?? 'ethereum',
                cancelTxHash
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-3 px-4 pb-4"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="font-mono text-xs">
                {cancelTxHash.slice(0, 10)}...{cancelTxHash.slice(-8)}
              </span>
            </a>
          )}

          <Execution.ErrorFooter />
        </TxStepCard.Root>
      </Execution.HistoricalGuard>
    </Execution.Root>
  )
}
