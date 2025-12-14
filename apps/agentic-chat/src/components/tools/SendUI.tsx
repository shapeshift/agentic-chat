import type { SendOutput } from '@shapeshiftoss/agentic-server'

import { StepStatus, useSendExecution } from '@/hooks/useSendExecution'
import { firstFourLastFour } from '@/lib/utils'
import { useChatStore } from '@/stores/chatStore'

import { Amount } from '../ui/Amount'
import { Skeleton } from '../ui/Skeleton'
import { TxStepCard } from '../ui/TxStepCard'

import type { ToolUIComponentProps } from './toolUIHelpers'

export function SendUI({ toolPart }: ToolUIComponentProps) {
  const { state, output, toolCallId } = toolPart
  const sendOutput = output as SendOutput | undefined
  const { isHistorical, getPersistedTransaction } = useChatStore()
  const address = sendOutput?.summary.from

  const sendData = state === 'output-available' && sendOutput ? sendOutput : null
  const { error, steps, networkName } = useSendExecution(toolCallId, state, sendData)

  const isHistoricalSkipped = isHistorical(toolCallId) && !getPersistedTransaction(toolCallId)

  if (isHistoricalSkipped) {
    return (
      <TxStepCard.Root>
        <div className="text-sm text-muted-foreground font-medium p-4">⏭️ Send execution skipped (no saved data)</div>
      </TxStepCard.Root>
    )
  }

  const [preparationStep, networkStep, sendStep] = steps
  if (!preparationStep || !networkStep || !sendStep) {
    return null
  }

  const completedCount = [preparationStep.status, networkStep.status, sendStep.status].filter(
    s => s === StepStatus.COMPLETE || s === StepStatus.SKIPPED
  ).length

  const footerMessage = (() => {
    if (state === 'output-error') return { type: 'error' as const, text: 'Failed to prepare send transaction' }
    if (error) return { type: 'error' as const, text: `Send failed: ${error}` }
    return null
  })()

  const summary = sendOutput?.summary

  return (
    <TxStepCard.Root>
      <TxStepCard.Header>
        <TxStepCard.HeaderRow>
          {address && (
            <div className="text-xs text-muted-foreground font-normal">Sent from {firstFourLastFour(address)}</div>
          )}
          <div className="text-sm text-muted-foreground font-normal">
            {summary?.estimatedFeeUsd ? (
              <Amount.Fiat value={summary.estimatedFeeUsd} />
            ) : (
              <Skeleton className="h-5 w-16" />
            )}
          </div>
        </TxStepCard.HeaderRow>
        <TxStepCard.HeaderRow>
          {summary ? (
            <div className="text-lg font-semibold">Send {summary.asset}</div>
          ) : (
            <Skeleton className="h-7 w-40" />
          )}
          <TxStepCard.Amount value={summary?.amount} symbol={summary?.symbol} prefix="-" isLoading={!summary} />
        </TxStepCard.HeaderRow>
      </TxStepCard.Header>

      {summary && (
        <TxStepCard.Content>
          <TxStepCard.Details>
            <TxStepCard.DetailItem label="From" value={summary.from} />
            <TxStepCard.DetailItem label="To" value={summary.to} />
            <TxStepCard.DetailItem label="Amount" value={summary.asset} />
            <TxStepCard.DetailItem label="Network" value={summary.chainName} />
            <TxStepCard.DetailItem
              label="Estimated Fee"
              value={<Amount.Crypto value={summary.estimatedFeeCrypto} symbol={summary.estimatedFeeSymbol} />}
            />
            {summary.ataCreation && (
              <TxStepCard.DetailItem
                label="Note"
                value="Will create recipient token account (~0.002 SOL)"
                className="text-amber-600"
              />
            )}
          </TxStepCard.Details>
        </TxStepCard.Content>
      )}

      <TxStepCard.Stepper completedCount={completedCount} totalCount={3}>
        <TxStepCard.Step status={preparationStep.status} connectorBottom>
          Preparing send transaction
        </TxStepCard.Step>
        <TxStepCard.Step status={networkStep.status} connectorTop connectorBottom>
          {networkName ? `Switch to ${networkName}` : 'Switch network'}
        </TxStepCard.Step>
        <TxStepCard.Step status={sendStep.status} connectorTop>
          Sign and send transaction
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
