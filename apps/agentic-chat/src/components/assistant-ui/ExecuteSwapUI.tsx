import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { executeSwapInput, executeSwapOutput } from '@shapeshiftoss/agentic-server'
import type { z } from 'zod'

import { TextShimmer } from '@/components/TextShimmer'
import { useSwapExecution } from '@/hooks/useSwapExecution'

type ExecuteSwapInput = z.infer<typeof executeSwapInput>
type ExecuteSwapOutput = z.infer<typeof executeSwapOutput>

type ExecuteSwapContentProps = Omit<ToolCallMessagePartProps<ExecuteSwapInput, ExecuteSwapOutput>, 'args'> & {
  args: Partial<ExecuteSwapInput>
}

const ExecuteSwapContent: React.FC<ExecuteSwapContentProps> = ({ status, result }) => {
  // Only pass swap data when tool is complete and successful
  const swapData = status.type === 'complete' && result ? result : null
  const { state, error } = useSwapExecution(swapData)

  if (status.type === 'running') {
    return <TextShimmer>Preparing swap transaction...</TextShimmer>
  }

  if (state === 'error') {
    return (
      <div className="text-muted-foreground">
        ⚠️ Swap execution failed: {error}
      </div>
    )
  }

  if (swapData) {
    const needsApproval = swapData.needsApproval
    const approvalComplete = state === 'approval_success' || state === 'signature_pending' || state === 'signature_success'
    const approvalSkipped = state === 'approval_skipped'
    const signaturePending = state === 'signature_pending'
    const signatureComplete = state === 'signature_success'

    return (
      <div className="space-y-2 text-muted-foreground">
        {/* Step 1: Approval */}
        {needsApproval && !approvalSkipped && (
          <div>
            {state === 'approval_pending' ? (
              <TextShimmer>⏳ Approving token spending...</TextShimmer>
            ) : approvalComplete ? (
              <div className="loading-success">✅ Token approved</div>
            ) : (
              <div>⏳ Approving token spending...</div>
            )}
          </div>
        )}

        {approvalSkipped && (
          <div className="loading-success">✅ Token approval skipped</div>
        )}
        
        {/* Step 2: Signature */}
        <div>
          {signaturePending ? (
            <TextShimmer>⏳ Signing swap transaction...</TextShimmer>
          ) : signatureComplete ? (
            <div className="loading-success">✅ Transaction signed</div>
          ) : (state !== 'idle' && state !== 'approval_pending') ? (
            <div>⏳ Signing swap transaction...</div>
          ) : null}
        </div>

        {/* Step 3: Complete */}
        {signatureComplete && (
          <div className="loading-success">🎉 Swap complete!</div>
        )}
      </div>
    )
  }

  return (
    <div className="text-muted-foreground">
      ⚠️ Swap execution failed
    </div>
  )
}

export const ExecuteSwapUI = makeAssistantToolUI<ExecuteSwapInput, ExecuteSwapOutput>({
  toolName: 'executeSwapTool',
  render: ExecuteSwapContent,
})
