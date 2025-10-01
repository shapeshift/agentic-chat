import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { InitiateSwapInput, InitiateSwapOutput } from '@shapeshiftoss/agentic-server'

import { StepStatus, useSwapExecution } from '@/hooks/useSwapExecution'

import { StatusText } from './StatusText'

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
    return <StatusText.Success>✅ Switched to {networkName}</StatusText.Success>
  }

  if (status === StepStatus.IN_PROGRESS) {
    return <StatusText.Loading>⏳ Switching to {networkName}...</StatusText.Loading>
  }

  return null
}

const ApprovalStep: React.FC<{
  status: StepStatus
}> = ({ status }) => {
  if (status === StepStatus.SKIPPED) {
    return <StatusText.Success>✅ Token approval skipped</StatusText.Success>
  }

  if (status === StepStatus.COMPLETE) {
    return <StatusText.Success>✅ Token approved</StatusText.Success>
  }

  if (status === StepStatus.IN_PROGRESS) {
    return <StatusText.Loading>⏳ Approving token spending...</StatusText.Loading>
  }

  return null
}

const SignatureStep: React.FC<{
  status: StepStatus
}> = ({ status }) => {
  if (status === StepStatus.COMPLETE) {
    return <StatusText.Success>✅ Transaction signed</StatusText.Success>
  }

  if (status === StepStatus.IN_PROGRESS) {
    return <StatusText.Loading>⏳ Signing swap transaction...</StatusText.Loading>
  }

  return null
}

const CompletionStep: React.FC<{
  status: StepStatus
}> = ({ status }) => {
  if (status === StepStatus.COMPLETE) {
    return <StatusText.Success>🎉 Swap complete!</StatusText.Success>
  }
  return null
}

const SwapError: React.FC<{ error?: string }> = ({ error }) => (
  <StatusText.Error>⚠️ Swap execution failed: {error}</StatusText.Error>
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

const InitiateSwapContent: React.FC<InitiateSwapContentProps> = ({ status, result, toolCallId }) => {
  const swapData = status.type === 'complete' && result && !('code' in result) ? result : null
  const { error, steps, networkName } = useSwapExecution(toolCallId, swapData)

  if (status.type === 'running') {
    return <StatusText.Loading>Getting swap quote...</StatusText.Loading>
  }

  if (status.type === 'complete') {
    if (!result || ('code' in result && result.code === 'TOOL_EXECUTION_FAILED')) {
      return <StatusText.Error>❌ Failed to get swap quote</StatusText.Error>
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

  return <StatusText.Error>Failed to get swap quote</StatusText.Error>
}

export const InitiateSwapUI = makeAssistantToolUI<InitiateSwapInput, InitiateSwapOutput>({
  toolName: 'initiateSwapTool',
  render: InitiateSwapContent,
})
