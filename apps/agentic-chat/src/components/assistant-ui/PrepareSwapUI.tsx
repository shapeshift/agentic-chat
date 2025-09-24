import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { prepareSwapInput, prepareSwapOutput } from '@shapeshiftoss/agentic-server'
import type { z } from 'zod'

import { TextShimmer } from '@/components/TextShimmer'

type PrepareSwapInput = z.infer<typeof prepareSwapInput>
type PrepareSwapOutput = z.infer<typeof prepareSwapOutput>

type PrepareSwapContentProps = Omit<ToolCallMessagePartProps<PrepareSwapInput, PrepareSwapOutput>, 'args'> & {
  args: Partial<PrepareSwapInput>
}

const PrepareSwapContent: React.FC<PrepareSwapContentProps> = ({ status, result }) => {
  if (status.type === 'running') {
    return <TextShimmer>Getting swap quote...</TextShimmer>
  }

  if (status.type === 'complete' && result) {
    return (
      <div className="text-muted-foreground text-sm">
        ✅ Quote found • Rate: 1 {result.swapData.sellAsset.symbol} ={' '}
        {(
          parseFloat(result.swapData.buyAmountCryptoPrecision) / parseFloat(result.swapData.sellAmountCryptoPrecision)
        ).toFixed(6)}{' '}
        {result.swapData.buyAsset.symbol}
      </div>
    )
  }

  return <div className="text-muted-foreground text-sm">⚠️ Failed to get swap quote</div>
}

export const PrepareSwapUI = makeAssistantToolUI<PrepareSwapInput, PrepareSwapOutput>({
  toolName: 'prepareSwapTool',
  render: PrepareSwapContent,
})
