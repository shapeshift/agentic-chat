import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { GetAssetsInput, GetAssetsOutput } from '@shapeshiftoss/agentic-server'

import { TextComplete } from '@/components/TextComplete'
import { TextShimmer } from '@/components/TextShimmer'

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

  switch (status.type) {
    case 'running': {
      return <TextShimmer>{`Fetching ${assetDetailsText}`}</TextShimmer>
    }
    case 'complete': {
      if (isError || !result || ('code' in result && result.code === 'TOOL_EXECUTION_FAILED')) {
        return <TextComplete>{`Failed to fetch ${assetDetailsText} ❌`}</TextComplete>
      }

      return <TextComplete>{`Fetched ${assetDetailsText} ✅`}</TextComplete>
    }
  }
}

export const GetAssets = makeAssistantToolUI<GetAssetsInput, GetAssetsOutput>({
  toolName: 'getAssetsTool',
  render: GetAssetsContent,
})
