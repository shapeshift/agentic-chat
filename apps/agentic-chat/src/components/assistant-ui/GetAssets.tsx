import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { GetAssetsInput, GetAssetsOutput } from '@shapeshiftoss/agentic-server'

import { TextComplete } from '@/components/TextComplete'
import { TextShimmer } from '@/components/TextShimmer'

type GetAssetsContentProps = Omit<ToolCallMessagePartProps<GetAssetsInput, GetAssetsOutput>, 'args'> & {
  args: Partial<GetAssetsInput>
}

const GetAssetsContent: React.FC<GetAssetsContentProps> = ({ args, status, result, isError }) => {
  switch (status.type) {
    case 'running': {
      const displayText = args.searchTerm || args.assetIds?.join(', ') || 'Fetching assets...'
      return <TextShimmer>{displayText}</TextShimmer>
    }
    case 'complete': {
      if (isError || !result || ('code' in result && result.code === 'TOOL_EXECUTION_FAILED')) {
        return <TextComplete>{'Failed to fetch asset details ❌'}</TextComplete>
      }

      return <TextComplete>{'Fetched asset details ✅'}</TextComplete>
    }
  }
}

export const GetAssets = makeAssistantToolUI<GetAssetsInput, GetAssetsOutput>({
  toolName: 'getAssetsTool',
  render: GetAssetsContent,
})
