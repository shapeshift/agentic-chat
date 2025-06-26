import { makeAssistantToolUI } from '@assistant-ui/react'
import { ArrowRightLeft } from 'lucide-react'

import { TextShimmer } from '../TextShimmer'

import { CollapsableDetails } from './CollapsableDetails'

// Types for bebopRate tool args and result
export type SwitchEvmChainArgs = {
  chain: string
  fromAsset: {
    address: string
    decimals: number
    symbol?: string
  }
  toAsset: {
    address: string
    decimals: number
    symbol: string
  }
  sellAmountCryptoPrecision: string
  fromAddress: string
}

const Icon = ArrowRightLeft

export type SwitchEvmChainResult = string

const SwitchEvmChainUI = makeAssistantToolUI<SwitchEvmChainArgs, SwitchEvmChainResult>({
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
