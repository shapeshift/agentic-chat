import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { InitiateSwapInput, InitiateSwapOutput } from '@shapeshiftoss/agentic-server'

import { TextShimmer } from '@/components/TextShimmer'
import { useLocalSwapExecution } from '@/hooks/useLocalSwapExecution'

type InitiateSwapContentProps = Omit<ToolCallMessagePartProps<InitiateSwapInput, InitiateSwapOutput>, 'args'> & {
  args: Partial<InitiateSwapInput>
}

const ApprovalStep: React.FC<{
  phase: 'idle' | 'approving' | 'swapping' | 'success' | 'error'
  progress: {
    needsApproval: boolean
    approvalComplete: boolean
    approvalSkipped: boolean
    swapComplete: boolean
  }
}> = ({ phase, progress }) => {
  if (progress.approvalSkipped) {
    return <div className="loading-success">✅ Token approval skipped</div>
  }

  if (!progress.needsApproval) {
    return null
  }

  switch (phase) {
    case 'approving':
      return <TextShimmer>⏳ Approving token spending...</TextShimmer>
    case 'swapping':
    case 'success':
      return <div className="loading-success">✅ Token approved</div>
    default:
      return <div>⏳ Approving token spending...</div>
  }
}

const SignatureStep: React.FC<{
  phase: 'idle' | 'approving' | 'swapping' | 'success' | 'error'
}> = ({ phase }) => {
  switch (phase) {
    case 'swapping':
      return <TextShimmer>⏳ Signing swap transaction...</TextShimmer>
    case 'success':
      return <div className="loading-success">✅ Transaction signed</div>
    case 'idle':
    case 'approving':
      return null
    default:
      return <div>⏳ Signing swap transaction...</div>
  }
}

const CompletionStep: React.FC<{
  phase: 'idle' | 'approving' | 'swapping' | 'success' | 'error'
}> = ({ phase }) => {
  if (phase === 'success') {
    return <div className="loading-success">🎉 Swap complete!</div>
  }
  return null
}

const SwapError: React.FC<{ error?: string }> = ({ error }) => (
  <div className="text-muted-foreground">⚠️ Swap execution failed: {error}</div>
)

const SwapProgress: React.FC<{
  phase: 'idle' | 'approving' | 'swapping' | 'success' | 'error'
  progress: {
    needsApproval: boolean
    approvalComplete: boolean
    approvalSkipped: boolean
    swapComplete: boolean
  }
}> = ({ phase, progress }) => {
  return (
    <div className="space-y-2 text-muted-foreground">
      <ApprovalStep phase={phase} progress={progress} />
      <SignatureStep phase={phase} />
      <CompletionStep phase={phase} />
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
  const { phase, error, progress } = useLocalSwapExecution(swapData)

  if (status.type === 'running') {
    return <TextShimmer>Getting swap quote...</TextShimmer>
  }

  if (status.type === 'complete') {
    if (!result || ('code' in result && result.code === 'TOOL_EXECUTION_FAILED')) {
      return <div className="text-muted-foreground">❌ Failed to get swap quote</div>
    }

    // Show swap execution error if it occurred
    if (phase === 'error') {
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
        <SwapProgress phase={phase} progress={progress} />
      </div>
    )
  }

  return <div className="text-muted-foreground">Failed to get swap quote</div>
}

export const InitiateSwapUI = makeAssistantToolUI<InitiateSwapInput, InitiateSwapOutput>({
  toolName: 'initiateSwapTool',
  render: InitiateSwapContent,
})
