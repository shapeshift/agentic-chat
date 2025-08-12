import { makeAssistantToolUI } from '@assistant-ui/react'
import { ArrowRightLeft } from 'lucide-react'

import { TextShimmer } from '@/components/TextShimmer'
import type { SwitchEvmChainParams, SwitchEvmChainResult } from '@/tools/switchEvmChain'

import { CollapsableDetails } from './CollapsableDetails'

const Icon = ArrowRightLeft

const SwitchEvmChainUI = makeAssistantToolUI<SwitchEvmChainParams, SwitchEvmChainResult>({
  toolName: 'switchEvmChain',
  render: ({ status, result, isError }) => {
    switch (status.type) {
      case 'complete':
        if (isError) {
          return (
            <CollapsableDetails title="An Error Occured" leftIcon={<Icon className="w-4 h-4 text-red-500" />}>
              {result}
            </CollapsableDetails>
          )
        }
        return (
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-green-500" />
            <p className="text-muted-foreground">Chain switched to {result}</p>
          </div>
        )
      default:
        return <TextShimmer>Switching chain...</TextShimmer>
    }
  },
})

export default SwitchEvmChainUI
