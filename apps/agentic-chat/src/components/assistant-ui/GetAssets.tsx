import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { GetAssetsInput, GetAssetsOutput } from '@shapeshiftoss/agentic-server'

import { StatusText } from './StatusText'

type GetAssetsContentProps = Omit<ToolCallMessagePartProps<GetAssetsInput, GetAssetsOutput>, 'args'> & {
  args: Partial<GetAssetsInput>
}

const GetAssetsContent: React.FC<GetAssetsContentProps> = ({ args, status, result, isError }) => {
  const assetDetailsText = (() => {
    const parts = ['asset details']
    if (args.searchTerm) parts.push(`for ${args.searchTerm}`)
    if (args.network) parts.push(`on ${args.network}`)
    return parts.join(' ')
  })()

  if (status.type === 'running') {
    return <StatusText.Loading>Fetching {assetDetailsText}</StatusText.Loading>
  }

  if (isError || !result || ('code' in result && result.code === 'TOOL_EXECUTION_FAILED')) {
    return <StatusText.Error>Failed to fetch {assetDetailsText} ❌</StatusText.Error>
  }

  return <StatusText.Success>Fetched {assetDetailsText} ✅</StatusText.Success>
}

export const GetAssets = makeAssistantToolUI<GetAssetsInput, GetAssetsOutput>({
  toolName: 'getAssetsTool',
  render: GetAssetsContent,
})
