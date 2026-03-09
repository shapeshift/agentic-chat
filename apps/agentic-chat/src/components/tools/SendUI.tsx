import { Execution } from '@/components/Execution'
import { SEND_STEPS, useSendExecution } from '@/hooks/useSendExecution'
import { StepStatus } from '@/lib/stepUtils'
import { firstFourLastFour } from '@/lib/utils'

import { Amount } from '../ui/Amount'
import { Skeleton } from '../ui/Skeleton'
import { TxStepCard } from '../ui/TxStepCard'

import type { ToolUIComponentProps } from './toolUIHelpers'

export function SendUI({ toolPart }: ToolUIComponentProps<'sendTool'>) {
  const { state: toolState, output, toolCallId } = toolPart
  const sendOutput = output
  const address = sendOutput?.summary.from

  const sendData = toolState === 'output-available' && sendOutput ? sendOutput : null
  const { state, steps, networkName } = useSendExecution(toolCallId, toolState, sendData)

  const prepareStepStatus = steps[SEND_STEPS.PREPARE]?.status ?? StepStatus.NOT_STARTED

  const hasError = toolState === 'output-error'
  const isLoading = !sendOutput && !hasError

  const summary = sendOutput?.summary

  return (
    <Execution.Root state={state} toolCallId={toolCallId}>
      <Execution.HistoricalGuard fallbackLabel="Send">
        <TxStepCard.Root>
          <TxStepCard.Header>
            <TxStepCard.HeaderRow>
              {address && (
                <div className="text-xs text-muted-foreground font-normal">Sent from {firstFourLastFour(address)}</div>
              )}
              <div className="text-sm text-muted-foreground font-normal">
                {summary?.estimatedFeeUsd ? (
                  <Amount.Fiat value={summary.estimatedFeeUsd} />
                ) : isLoading ? (
                  <Skeleton className="h-5 w-16" />
                ) : (
                  <>—</>
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

          <Execution.Stepper>
            <Execution.Step index={SEND_STEPS.PREPARE} label="Preparing send transaction" overrideStatus={prepareStepStatus} connectorBottom />
            <Execution.Step index={SEND_STEPS.NETWORK} label={networkName ? `Switch to ${networkName}` : 'Switch network'} connectorTop connectorBottom />
            <Execution.Step index={SEND_STEPS.SEND} label="Sign and send transaction" connectorTop />
          </Execution.Stepper>
          <Execution.ErrorFooter />
        </TxStepCard.Root>
      </Execution.HistoricalGuard>
    </Execution.Root>
  )
}
