import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { GetCoingeckoAssetsInput, GetCoingeckoAssetsOutput } from '@shapeshiftoss/agentic-server'

import { StatusText } from './StatusText'

type GetCoingeckoAssetsContentProps = Omit<
  ToolCallMessagePartProps<GetCoingeckoAssetsInput, GetCoingeckoAssetsOutput>,
  'args'
> & {
  args: Partial<GetCoingeckoAssetsInput>
}

const GetCoingeckoAssetsContent: React.FC<GetCoingeckoAssetsContentProps> = ({ status, result, isError }) => {
  if (status.type === 'running') {
    return <StatusText.Loading>Checking CoinGecko for asset details</StatusText.Loading>
  }

  if (isError || !result || ('code' in result && result.code === 'TOOL_EXECUTION_FAILED')) {
    return <StatusText.Error>Failed to discover asset details on CoinGecko ❌</StatusText.Error>
  }

  return <StatusText.Success>Asset details discovered on CoinGecko ✅</StatusText.Success>
}

export const GetCoingeckoAssets = makeAssistantToolUI<GetCoingeckoAssetsInput, GetCoingeckoAssetsOutput>({
  toolName: 'getCoingeckoAssetsTool',
  render: GetCoingeckoAssetsContent,
})
