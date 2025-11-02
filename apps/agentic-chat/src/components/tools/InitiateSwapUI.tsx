import { useAppKitAccount } from '@reown/appkit/react'
import type { InitiateSwapOutput } from '@shapeshiftoss/agentic-server'
import type { DynamicToolUIPart } from 'ai'

import { StepStatus, useSwapExecution } from '@/hooks/useSwapExecution'
import { firstFourLastFour } from '@/lib/utils'
import { useToolExecutionStore } from '@/stores/toolExecutionStore'

import { SwapCard } from '../ui/SwapCard'
import { TxStepCard } from '../ui/TxStepCard'

interface InitiateSwapUIProps {
  toolPart: DynamicToolUIPart
}

export function InitiateSwapUI({ toolPart }: InitiateSwapUIProps) {
  const { state, output, toolCallId } = toolPart
  const swapOutput = output as InitiateSwapOutput | undefined
  const { isHistorical, getPersistedState } = useToolExecutionStore()
  const { address } = useAppKitAccount()

  const swapData = state === 'output-available' && swapOutput ? swapOutput : null
  const { error, steps, networkName } = useSwapExecution(toolCallId, swapData)

  if (state === 'input-streaming' || state === 'input-available') {
    return (
      <TxStepCard.Root>
        <TxStepCard.Header>
          <TxStepCard.HeaderRow>
            {address && (
              <div className="text-xs text-muted-foreground font-normal">
                Received from {firstFourLastFour(address)}
              </div>
            )}
            <div className="text-sm text-muted-foreground font-normal">—</div>
          </TxStepCard.HeaderRow>
          <TxStepCard.HeaderRow>
            <div className="text-xl font-bold">Swap Quote</div>
            <div className="text-xl font-bold text-muted-foreground">—</div>
          </TxStepCard.HeaderRow>
        </TxStepCard.Header>

        <TxStepCard.Stepper completedCount={0} totalCount={1}>
          <TxStepCard.Step status={StepStatus.IN_PROGRESS} connectorBottom={false}>
            Getting swap quote
          </TxStepCard.Step>
        </TxStepCard.Stepper>
      </TxStepCard.Root>
    )
  }

  if (state === 'output-error' || !swapOutput) {
    return (
      <TxStepCard.Root>
        <TxStepCard.Header>
          <TxStepCard.HeaderRow>
            {address && (
              <div className="text-xs text-muted-foreground font-normal">
                Received from {firstFourLastFour(address)}
              </div>
            )}
            <div className="text-sm text-muted-foreground font-normal">—</div>
          </TxStepCard.HeaderRow>
          <TxStepCard.HeaderRow>
            <div className="text-xl font-bold">Swap Quote</div>
            <div className="text-xl font-bold text-muted-foreground">—</div>
          </TxStepCard.HeaderRow>
        </TxStepCard.Header>

        <TxStepCard.Stepper completedCount={0} totalCount={1}>
          <TxStepCard.Step status={StepStatus.FAILED} connectorBottom={false}>
            Getting swap quote
          </TxStepCard.Step>
          <div className="text-sm text-red-500 font-medium mt-4">Failed to get swap quote</div>
        </TxStepCard.Stepper>
      </TxStepCard.Root>
    )
  }

  const swap = swapOutput.swapData
  if (!swap) return null
  const isHistoricalSkipped = isHistorical(toolCallId) && !getPersistedState(toolCallId)

  const displaySteps = isHistoricalSkipped ? steps.map(s => ({ ...s, status: StepStatus.SKIPPED })) : steps

  const completedCount = displaySteps.filter(
    s => s.status === StepStatus.COMPLETE || s.status === StepStatus.SKIPPED
  ).length

  const footerMessage = (() => {
    if (error) return { type: 'error' as const, text: `Swap execution failed: ${error}` }
    if (isHistoricalSkipped) return { type: 'info' as const, text: '⏭️ Swap execution skipped (no saved data)' }
    return null
  })()

  return (
    <SwapCard
      address={address}
      swap={swap}
      steps={displaySteps}
      networkName={networkName}
      completedCount={completedCount}
      footerMessage={footerMessage}
    />
  )
}
