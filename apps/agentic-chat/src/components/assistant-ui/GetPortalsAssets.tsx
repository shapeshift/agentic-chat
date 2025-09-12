import type { ToolCallContentPartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { GetPortalsAssetsInput, GetPortalsAssetsOutput } from '@shapeshiftoss/agentic-server'

import { TextComplete } from '@/components/TextComplete'
import { TextShimmer } from '@/components/TextShimmer'

type GetPortalsAssetsContentProps = Omit<
  ToolCallContentPartProps<GetPortalsAssetsInput, GetPortalsAssetsOutput>,
  'args'
> & {
  args: Partial<GetPortalsAssetsInput>
}

const GetPortalsAssetsContent: React.FC<GetPortalsAssetsContentProps> = ({ status, result, isError }) => {
  switch (status.type) {
    case 'running': {
      return <TextShimmer>Checking Portals for asset details</TextShimmer>
    }
    case 'complete': {
      if (isError || !result || ('code' in result && result.code === 'TOOL_EXECUTION_FAILED')) {
        return <TextComplete>{'Failed to discover asset details on Portals ❌'}</TextComplete>
      }

      return <TextComplete>{'Asset details discovered on Portals ✅'}</TextComplete>
    }
  }
}

export const GetPortalsAssets = makeAssistantToolUI<GetPortalsAssetsInput, GetPortalsAssetsOutput>({
  toolName: 'getPortalsAssetsTool',
  render: GetPortalsAssetsContent,
})
