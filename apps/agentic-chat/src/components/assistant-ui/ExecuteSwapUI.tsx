import { makeAssistantToolUI } from '@assistant-ui/react'
import { ArrowRightLeft } from 'lucide-react'
import z from 'zod'

import { TextShimmer } from '../TextShimmer'

import { CollapsableDetails } from './CollapsableDetails'

export const executeSwapParams = z.object({}).strict()

export type ExecuteSwapArgs = z.infer<typeof executeSwapParams>
export type ExecuteSwapResult = string // tx hash

const Icon = ArrowRightLeft

const ExecuteSwapUI = makeAssistantToolUI<ExecuteSwapArgs, ExecuteSwapResult>({
  toolName: 'executeSwap',
  render: ({ status, result, isError, toolName }) => {
    switch (status.type) {
      case 'running':
      case 'requires-action':
      case 'incomplete': {
        return <TextShimmer>Executing swap...</TextShimmer>
      }
      case 'complete':
        if (isError) {
          return (
            <CollapsableDetails
              title={`An Error Occured with ${toolName}`}
              leftIcon={<Icon className="w-4 h-4 text-red-500" />}
            >
              {result}
            </CollapsableDetails>
          )
        }
        return (
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-green-500" />
            <p className="text-muted-foreground">Swap transaction sent: {result}</p>
          </div>
        )
    }
  },
})

export default ExecuteSwapUI
