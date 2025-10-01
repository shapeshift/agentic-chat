import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { SwitchNetworkInput, SwitchNetworkOutput } from '@shapeshiftoss/agentic-server'
import { ArrowRightLeft } from 'lucide-react'

import { TextShimmer } from '@/components/TextShimmer'
import { useNetworkSwitch } from '@/hooks/useNetworkSwitch'

import { CollapsableDetails } from './CollapsableDetails'

const Icon = ArrowRightLeft

type SwitchNetworkContentProps = Omit<ToolCallMessagePartProps<SwitchNetworkInput, SwitchNetworkOutput>, 'args'> & {
  args: Partial<SwitchNetworkInput>
}

const SwitchNetworkContent: React.FC<SwitchNetworkContentProps> = ({ status, result, toolCallId }) => {
  const networkData = status.type === 'complete' && result && !('code' in result) ? result : null

  const { phase, error } = useNetworkSwitch(toolCallId, networkData)

  if (status.type === 'running') {
    return <TextShimmer>Preparing network switch...</TextShimmer>
  }

  if (status.type === 'complete') {
    if (!result || ('code' in result && result.code === 'TOOL_EXECUTION_FAILED')) {
      return (
        <CollapsableDetails
          title="Failed to prepare network switch"
          leftIcon={<Icon className="w-4 h-4 text-red-500" />}
        >
          {result && 'message' in result ? String(result.message) : 'Unknown error'}
        </CollapsableDetails>
      )
    }

    if (phase === 'error') {
      return (
        <CollapsableDetails title="Network switch failed" leftIcon={<Icon className="w-4 h-4 text-red-500" />}>
          {error || 'Unknown error'}
        </CollapsableDetails>
      )
    }

    if (phase === 'switching') {
      return (
        <div className="flex items-center gap-2">
          <TextShimmer>Switching to {result.networkName}...</TextShimmer>
        </div>
      )
    }

    if (phase === 'success') {
      return (
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-green-500" />
          <p className="text-muted-foreground">Switched to {result.networkName}</p>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2">
        <TextShimmer>Switching to {result.networkName}...</TextShimmer>
      </div>
    )
  }

  return (
    <CollapsableDetails title="Network switch failed" leftIcon={<Icon className="w-4 h-4 text-red-500" />}>
      Unknown status
    </CollapsableDetails>
  )
}

export const SwitchNetworkUI = makeAssistantToolUI<SwitchNetworkInput, SwitchNetworkOutput>({
  toolName: 'switchNetworkTool',
  render: SwitchNetworkContent,
})
