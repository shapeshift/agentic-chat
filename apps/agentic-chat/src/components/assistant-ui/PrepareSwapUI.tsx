import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { PrepareSwapInput, PrepareSwapOutput } from '@shapeshiftoss/agentic-server'

import { TextShimmer } from '@/components/TextShimmer'

type PrepareSwapContentProps = Omit<ToolCallMessagePartProps<PrepareSwapInput, PrepareSwapOutput>, 'args'> & {
  args: Partial<PrepareSwapInput>
}

const PrepareSwapContent: React.FC<PrepareSwapContentProps> = ({ status, result }) => {
  if (status.type === 'running') {
    return <TextShimmer>Getting swap quote...</TextShimmer>
  }

  if (status.type === 'complete') {
    if (!result || ('code' in result && result.code === 'TOOL_EXECUTION_FAILED')) {
      return <div className="text-muted-foreground">❌ Failed to get swap quote</div>
    }

    return (
      <div className="text-muted-foreground">
        ✅ Quote found • Rate: 1 {result.swapData.sellAsset.symbol} ={' '}
        {(
          parseFloat(result.swapData.buyAmountCryptoPrecision) / parseFloat(result.swapData.sellAmountCryptoPrecision)
        ).toFixed(6)}{' '}
        {result.swapData.buyAsset.symbol}
      </div>
    )
  }

  return <div className="text-muted-foreground">Failed to get swap quote</div>
}

export const PrepareSwapUI = makeAssistantToolUI<PrepareSwapInput, PrepareSwapOutput>({
  toolName: 'prepareSwapTool',
  render: PrepareSwapContent,
})
