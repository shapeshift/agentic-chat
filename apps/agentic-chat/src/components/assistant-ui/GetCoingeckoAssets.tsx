import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { GetCoingeckoAssetsInput, GetCoingeckoAssetsOutput } from '@shapeshiftoss/agentic-server'

import { TextComplete } from '@/components/TextComplete'
import { TextShimmer } from '@/components/TextShimmer'

type GetCoingeckoAssetsContentProps = Omit<
  ToolCallMessagePartProps<GetCoingeckoAssetsInput, GetCoingeckoAssetsOutput>,
  'args'
> & {
  args: Partial<GetCoingeckoAssetsInput>
}

const GetCoingeckoAssetsContent: React.FC<GetCoingeckoAssetsContentProps> = ({ status, result, isError }) => {
  switch (status.type) {
    case 'running': {
      return <TextShimmer>Checking CoinGecko for asset details</TextShimmer>
    }
    case 'complete': {
      if (isError || !result || ('code' in result && result.code === 'TOOL_EXECUTION_FAILED')) {
        return <TextComplete>{'Failed to discover asset details on CoinGecko ❌'}</TextComplete>
      }

      return <TextComplete>{'Asset details discovered on CoinGecko ✅'}</TextComplete>
    }
  }
}

export const GetCoingeckoAssets = makeAssistantToolUI<GetCoingeckoAssetsInput, GetCoingeckoAssetsOutput>({
  toolName: 'getCoingeckoAssetsTool',
  render: GetCoingeckoAssetsContent,
})
