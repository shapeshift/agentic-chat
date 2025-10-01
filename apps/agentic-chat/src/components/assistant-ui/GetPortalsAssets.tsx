import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { GetPortalsAssetsInput, GetPortalsAssetsOutput } from '@shapeshiftoss/agentic-server'

import { StatusText } from './StatusText'

type GetPortalsAssetsContentProps = Omit<
  ToolCallMessagePartProps<GetPortalsAssetsInput, GetPortalsAssetsOutput>,
  'args'
> & {
  args: Partial<GetPortalsAssetsInput>
}

const GetPortalsAssetsContent: React.FC<GetPortalsAssetsContentProps> = ({ status, result, isError }) => {
  if (status.type === 'running') {
    return <StatusText.Loading>Checking Portals for asset details</StatusText.Loading>
  }

  if (isError || !result || ('code' in result && result.code === 'TOOL_EXECUTION_FAILED')) {
    return <StatusText.Error>Failed to discover asset details on Portals ❌</StatusText.Error>
  }

  return <StatusText.Success>Asset details discovered on Portals ✅</StatusText.Success>
}

export const GetPortalsAssets = makeAssistantToolUI<GetPortalsAssetsInput, GetPortalsAssetsOutput>({
  toolName: 'getPortalsAssetsTool',
  render: GetPortalsAssetsContent,
})
