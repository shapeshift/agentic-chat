import type { ToolCallContentPartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import { Send } from 'lucide-react'
import z from 'zod'

import { TextShimmer } from '../TextShimmer'

import { CollapsableDetails } from './CollapsableDetails'

const Icon = Send

export const sendTransactionParams = z.object({
  to: z.string().describe('The address to send the transaction to'),
  valueCryptoPrecision: z.string().describe('Amount to send in human format, e.g. 1 for 1 ETH'),
  data: z.string().describe('The transaction data (hex string)'),
  chainId: z.number().describe('The chain ID where the transaction will be sent'),
})

export type SendTransactionParams = z.infer<typeof sendTransactionParams>
export type SendTransactionResult = string // Transaction hash

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
