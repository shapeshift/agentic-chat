import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { executeSwapInput, executeSwapOutput } from '@shapeshiftoss/agentic-server'
import type { z } from 'zod'

import { TextShimmer } from '@/components/TextShimmer'
import { useLocalSwapExecution } from '@/hooks/useLocalSwapExecution'

type ExecuteSwapInput = z.infer<typeof executeSwapInput>
type ExecuteSwapOutput = z.infer<typeof executeSwapOutput>

type ExecuteSwapContentProps = Omit<ToolCallMessagePartProps<ExecuteSwapInput, ExecuteSwapOutput>, 'args'> & {
  args: Partial<ExecuteSwapInput>
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

const ExecuteSwapContent: React.FC<ExecuteSwapContentProps> = ({ status, result }) => {
  const swapData = status.type === 'complete' && result ? result : null
  const { phase, error, progress } = useLocalSwapExecution(swapData)

  if (status.type === 'running') {
    return <TextShimmer>Preparing swap transaction...</TextShimmer>
  }

  if (phase === 'error') {
    return <SwapError error={error} />
  }

  if (swapData) {
    return <SwapProgress phase={phase} progress={progress} />
  }

  return <div className="text-muted-foreground">⚠️ Swap execution failed</div>
}

export const ExecuteSwapUI = makeAssistantToolUI<ExecuteSwapInput, ExecuteSwapOutput>({
  toolName: 'triggerSwapExecutionTool',
  render: ExecuteSwapContent,
})
