import type { ToolCallContentPartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { AssetConverterInput, AssetConverterOutput } from '@shapeshiftoss/agentic-server'

import { TextComplete } from '@/components/TextComplete'
import { TextShimmer } from '@/components/TextShimmer'

type AssetConverterContentProps = Omit<ToolCallContentPartProps<AssetConverterInput, AssetConverterOutput>, 'args'> & {
  args: Partial<AssetConverterInput>
}

const AssetConverterContent: React.FC<AssetConverterContentProps> = ({ status, result, isError }) => {
  switch (status.type) {
    case 'running':
    case 'requires-action':
    case 'incomplete': {
      return <TextShimmer>Formatting asset details</TextShimmer>
    }
    case 'complete': {
      if (isError || !result || ('code' in result && result.code === 'TOOL_EXECUTION_FAILED')) {
        return <TextComplete>{'Failed to format assets details ❌'}</TextComplete>
      }

      return <TextComplete>{'Asset details formatted successfully ✅'}</TextComplete>
    }
  }
}

export const AssetConverter = makeAssistantToolUI<AssetConverterInput, AssetConverterOutput>({
  toolName: 'assetConverterTool',
  render: AssetConverterContent,
})
