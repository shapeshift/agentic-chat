import type { ToolCallContentPartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { SearchCoingeckoAssetsInput, SearchCoingeckoAssetsOutput } from '@shapeshiftoss/agentic-server'

import { TextComplete } from '@/components/TextComplete'
import { TextShimmer } from '@/components/TextShimmer'

type GetAssetsContentProps = Omit<
  ToolCallContentPartProps<SearchCoingeckoAssetsInput, SearchCoingeckoAssetsOutput>,
  'args'
> & {
  args: Partial<SearchCoingeckoAssetsInput>
}

const GetAssetsContent: React.FC<GetAssetsContentProps> = ({ status, result, isError }) => {
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

export const GetAssets = makeAssistantToolUI<SearchCoingeckoAssetsInput, SearchCoingeckoAssetsOutput>({
  toolName: 'searchCoingeckoAssetsTool',
  render: GetAssetsContent,
})
