import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { GetAssetsInput, GetAssetsOutput } from '@shapeshiftoss/agentic-server'

import { TextComplete } from '@/components/TextComplete'
import { TextShimmer } from '@/components/TextShimmer'

type AssetAgentContentProps = Omit<ToolCallMessagePartProps<GetAssetsInput, GetAssetsOutput>, 'args'> & {
  args: Partial<GetAssetsInput>
}

const AssetAgentContent: React.FC<AssetAgentContentProps> = ({ args, status, result, isError }) => {
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

export const AssetAgent = makeAssistantToolUI<GetAssetsInput, GetAssetsOutput>({
  toolName: 'getAssets',
  render: AssetAgentContent,
})
