import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type {
  InitiateSwapInput,
  InitiateSwapOutput,
  InitiateSwapUsdInput,
  InitiateSwapUsdOutput,
} from '@shapeshiftoss/agentic-server'
import type { ReactNode } from 'react'

import { StepStatus, useSwapExecution } from '@/hooks/useSwapExecution'

import { StatusText } from './StatusText'

type InitiateSwapContentProps = Omit<ToolCallMessagePartProps<InitiateSwapInput, InitiateSwapOutput>, 'args'> & {
  args: Partial<InitiateSwapInput>
}

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

const InitiateSwapContent: React.FC<InitiateSwapContentProps> = ({ status, result, toolCallId }) => {
  const swapData = status.type === 'complete' && result && !('code' in result) ? result : null
  const { error, steps, networkName } = useSwapExecution(toolCallId, swapData)

  if (status.type === 'running') {
    return <StatusText.Loading>Getting swap quote...</StatusText.Loading>
  }

  if (!result || ('code' in result && result.code === 'TOOL_EXECUTION_FAILED')) {
    return <StatusText.Error>❌ Failed to get swap quote</StatusText.Error>
  }

  if (error) {
    return <StatusText.Error>⚠️ Swap execution failed: {error}</StatusText.Error>
  }

  return (
    <div className="space-y-2">
      <div className="text-muted-foreground">
        ✅ Quote found • Rate: 1 {result.swapData.sellAsset.symbol} ={' '}
        {(() => {
          const buy = Number(result.swapData.buyAmountCryptoPrecision)
          const sell = Number(result.swapData.sellAmountCryptoPrecision)
          if (!Number.isFinite(buy) || !Number.isFinite(sell) || sell <= 0) return '—'
          return (buy / sell).toFixed(6)
        })()}{' '}
        {result.swapData.buyAsset.symbol}
      </div>
      <SwapProgress steps={steps} networkName={networkName} />
    </div>
  )
}

export const InitiateSwapUI = makeAssistantToolUI<InitiateSwapInput, InitiateSwapOutput>({
  toolName: 'initiateSwapTool',
  render: InitiateSwapContent,
})

export const InitiateSwapUsdUI = makeAssistantToolUI<InitiateSwapUsdInput, InitiateSwapUsdOutput>({
  toolName: 'initiateSwapUsdTool',
  render: InitiateSwapContent,
})
