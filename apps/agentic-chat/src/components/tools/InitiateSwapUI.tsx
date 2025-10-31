import type { InitiateSwapOutput } from '@shapeshiftoss/agentic-server'
import type { DynamicToolUIPart } from 'ai'
import type { ReactNode } from 'react'

import { StepStatus, useSwapExecution } from '@/hooks/useSwapExecution'
import { useToolExecutionStore } from '@/stores/toolExecutionStore'

import { StatusText } from '../ui/StatusText'

const Step: React.FC<{
  status: StepStatus
  loading: ReactNode
  complete: ReactNode
  skipped?: ReactNode
}> = ({ status, loading, complete, skipped }) => {
  if (status === StepStatus.SKIPPED) return skipped || null
  if (status === StepStatus.COMPLETE) return <StatusText.Success>{complete}</StatusText.Success>
  if (status === StepStatus.IN_PROGRESS) return <StatusText.Loading>{loading}</StatusText.Loading>
  return null
}

const SwapProgress: React.FC<{
  steps: {
    networkSwitch: StepStatus
    approval: StepStatus
    swap: StepStatus
  }
  networkName?: string
}> = ({ steps, networkName }) => {
  return (
    <div className="space-y-2 text-muted-foreground">
      <Step
        status={steps.networkSwitch}
        loading={`⏳ Switching to ${networkName}...`}
        complete={`✅ Switched to ${networkName}`}
      />
      <Step
        status={steps.approval}
        loading="⏳ Approving token spending..."
        complete="✅ Token approved"
        skipped={<StatusText.Success>✅ Token approval skipped</StatusText.Success>}
      />
      <Step status={steps.swap} loading="⏳ Signing swap transaction..." complete="✅ Transaction signed" />
      {steps.swap === StepStatus.COMPLETE && <StatusText.Success>🎉 Swap complete!</StatusText.Success>}
    </div>
  )
}

interface InitiateSwapUIProps {
  toolPart: DynamicToolUIPart
}

export function InitiateSwapUI({ toolPart }: InitiateSwapUIProps) {
  const { state, output, toolCallId } = toolPart
  const swapOutput = output as InitiateSwapOutput | undefined
  const { isHistorical, getPersistedState } = useToolExecutionStore()

  const swapData = state === 'output-available' && swapOutput ? swapOutput : null
  const { error, steps, networkName } = useSwapExecution(toolCallId, swapData)

  if (state === 'input-streaming' || state === 'input-available') {
    return <StatusText.Loading>Getting swap quote...</StatusText.Loading>
  }

  if (state === 'output-error' || !swapOutput) {
    return <StatusText.Error>❌ Failed to get swap quote</StatusText.Error>
  }

  if (error) {
    return <StatusText.Error>⚠️ Swap execution failed: {error}</StatusText.Error>
  }

  if (isHistorical(toolCallId) && !getPersistedState(toolCallId)) {
    return <StatusText>⏭️ Swap execution skipped (no saved data)</StatusText>
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background p-3">
      <div className="text-base text-muted-foreground">
        ✅ Quote found • Rate: 1 {swapOutput.swapData.sellAsset.symbol} ={' '}
        {(() => {
          const buy = Number(swapOutput.swapData.buyAmountCryptoPrecision)
          const sell = Number(swapOutput.swapData.sellAmountCryptoPrecision)
          if (!Number.isFinite(buy) || !Number.isFinite(sell) || sell <= 0) return '—'
          return (buy / sell).toFixed(6)
        })()}{' '}
        {swapOutput.swapData.buyAsset.symbol}
      </div>
      <SwapProgress steps={steps} networkName={networkName} />
    </div>
  )
}
