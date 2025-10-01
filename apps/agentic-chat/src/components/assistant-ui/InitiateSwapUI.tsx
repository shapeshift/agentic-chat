import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { InitiateSwapInput, InitiateSwapOutput } from '@shapeshiftoss/agentic-server'

import { TextShimmer } from '@/components/TextShimmer'
import { StepStatus, useLocalSwapExecution } from '@/hooks/useLocalSwapExecution'

type InitiateSwapContentProps = Omit<ToolCallMessagePartProps<InitiateSwapInput, InitiateSwapOutput>, 'args'> & {
  args: Partial<InitiateSwapInput>
}

const NetworkSwitchStep: React.FC<{
  status: StepStatus
  networkName?: string
}> = ({ status, networkName }) => {
  if (status === StepStatus.SKIPPED) {
    return null
  }

  if (status === StepStatus.COMPLETE) {
    return <div className="loading-success">✅ Switched to {networkName}</div>
  }

  if (status === StepStatus.IN_PROGRESS) {
    return <TextShimmer>⏳ Switching to {networkName}...</TextShimmer>
  }

  return null
}

const ApprovalStep: React.FC<{
  status: StepStatus
}> = ({ status }) => {
  if (status === StepStatus.SKIPPED) {
    return <div className="loading-success">✅ Token approval skipped</div>
  }

  if (status === StepStatus.COMPLETE) {
    return <div className="loading-success">✅ Token approved</div>
  }

  if (status === StepStatus.IN_PROGRESS) {
    return <TextShimmer>⏳ Approving token spending...</TextShimmer>
  }

  return null
}

const SignatureStep: React.FC<{
  status: StepStatus
}> = ({ status }) => {
  if (status === StepStatus.COMPLETE) {
    return <div className="loading-success">✅ Transaction signed</div>
  }

  if (status === StepStatus.IN_PROGRESS) {
    return <TextShimmer>⏳ Signing swap transaction...</TextShimmer>
  }

  return null
}

const CompletionStep: React.FC<{
  status: StepStatus
}> = ({ status }) => {
  if (status === StepStatus.COMPLETE) {
    return <div className="loading-success">🎉 Swap complete!</div>
  }
  return null
}

const SwapError: React.FC<{ error?: string }> = ({ error }) => (
  <div className="text-muted-foreground">⚠️ Swap execution failed: {error}</div>
)

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
      <NetworkSwitchStep status={steps.networkSwitch} networkName={networkName} />
      <ApprovalStep status={steps.approval} />
      <SignatureStep status={steps.swap} />
      <CompletionStep status={steps.swap} />
    </div>
  )
}

const InitiateSwapContent: React.FC<InitiateSwapContentProps> = ({ status, result }) => {
  const swapData =
    status.type === 'complete' && result && !('code' in result)
      ? {
          ...result,
          action: 'initiate_swap_execution' as const,
          timestamp: Date.now(),
        }
      : null
  const { error, steps, networkName } = useLocalSwapExecution(swapData)

  if (status.type === 'running') {
    return <TextShimmer>Getting swap quote...</TextShimmer>
  }

  if (status.type === 'complete') {
    if (!result || ('code' in result && result.code === 'TOOL_EXECUTION_FAILED')) {
      return <div className="text-muted-foreground">❌ Failed to get swap quote</div>
    }

    // Show swap execution error if it occurred
    if (error) {
      return <SwapError error={error} />
    }

    // Show quote info and execution progress
    return (
      <div className="space-y-2">
        <div className="text-muted-foreground">
          ✅ Quote found • Rate: 1 {result.swapData.sellAsset.symbol} ={' '}
          {(
            parseFloat(result.swapData.buyAmountCryptoPrecision) / parseFloat(result.swapData.sellAmountCryptoPrecision)
          ).toFixed(6)}{' '}
          {result.swapData.buyAsset.symbol}
        </div>
        <SwapProgress steps={steps} networkName={networkName} />
      </div>
    )
  }

  return <div className="text-muted-foreground">Failed to get swap quote</div>
}

export const InitiateSwapUI = makeAssistantToolUI<InitiateSwapInput, InitiateSwapOutput>({
  toolName: 'initiateSwapTool',
  render: InitiateSwapContent,
})
