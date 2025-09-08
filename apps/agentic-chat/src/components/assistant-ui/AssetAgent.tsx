import type { ToolCallContentPartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { AssetAgentInput, AssetAgentOutput } from '@shapeshiftoss/agentic-server'

import { TextComplete } from '@/components/TextComplete'
import { TextShimmer } from '@/components/TextShimmer'

type AssetAgentContentProps = Omit<ToolCallContentPartProps<AssetAgentInput, AssetAgentOutput>, 'args'> & {
  args: Partial<AssetAgentInput>
}

const AssetAgentContent: React.FC<AssetAgentContentProps> = ({ status, result, isError }) => {
  switch (status.type) {
    case 'running':
    case 'requires-action':
    case 'incomplete': {
      return <TextShimmer>{'Fetching asset details'}</TextShimmer>
    }
    case 'complete': {
      if (isError || !result) {
        return <TextComplete>{JSON.stringify(result || 'Failed to fetch asset details')}</TextComplete>
      }

      return <TextComplete>{'Fetched asset details'}</TextComplete>
    }
  }
}

export const AssetAgent = makeAssistantToolUI<AssetAgentInput, AssetAgentOutput>({
  toolName: 'assetAgentTool',
  render: AssetAgentContent,
})
