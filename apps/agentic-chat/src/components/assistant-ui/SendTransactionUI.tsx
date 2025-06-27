import type { ToolCallContentPartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import { Send } from 'lucide-react'

import type { SendTransactionParams } from '../../tools/sendTransaction'
import { TextShimmer } from '../TextShimmer'

import { CollapsableDetails } from './CollapsableDetails'

const Icon = Send
export type SendTransactionResult = string // tx hash

type SendTransactionContentProps = Omit<
  ToolCallContentPartProps<SendTransactionParams, SendTransactionResult>,
  'args'
> & {
  args: Partial<SendTransactionParams>
}

export const SendTransactionContent: React.FC<SendTransactionContentProps> = ({
  status,
  result,
  args,
  isError,
  toolName,
}) => {
  switch (status.type) {
    case 'running':
    case 'requires-action':
    case 'incomplete': {
      if (!args.to) return <TextShimmer>Sending transaction</TextShimmer>

      return <TextShimmer>Sending transaction to {args.to}...</TextShimmer>
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
          <p className="text-muted-foreground">Transaction sent: {result}</p>
        </div>
      )
  }
}

const SendTransactionUI = makeAssistantToolUI<SendTransactionParams, SendTransactionResult>({
  toolName: 'sendTransaction',
  render: SendTransactionContent,
})

export default SendTransactionUI
