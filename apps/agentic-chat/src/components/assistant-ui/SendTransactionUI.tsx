import { makeAssistantToolUI } from '@assistant-ui/react'
import { Send } from 'lucide-react'

import { TextShimmer } from '../TextShimmer'

import { CollapsableDetails } from './CollapsableDetails'

export type SendTransactionArgs = {
  to: string
  valueCryptoPrecision: string
  data: string
  chainId: number
}

const Icon = Send
export type SendTransactionResult = string // tx hash

const SendTransactionUI = makeAssistantToolUI<SendTransactionArgs, SendTransactionResult>({
  toolName: 'sendTransaction',
  render: ({ status, result, args, isError, toolName }) => {
    switch (status.type) {
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
            <p className="text-muted-foreground">Transaction sent: {result}</p>
          </div>
        )
      default:
        return <TextShimmer>Sending transaction to {args.to}...</TextShimmer>
    }
  },
})

export default SendTransactionUI
