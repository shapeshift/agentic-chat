import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import { Send } from 'lucide-react'
import z from 'zod'

import { CollapsableDetails } from './CollapsableDetails'
import { StatusText } from './StatusText'

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
  ToolCallMessagePartProps<SendTransactionParams, SendTransactionResult>,
  'args'
> & {
  args: Partial<SendTransactionParams>
}

const SendTransactionContent: React.FC<SendTransactionContentProps> = ({ status, result, args, isError, toolName }) => {
  switch (status.type) {
    case 'running':
    case 'requires-action':
    case 'incomplete': {
      if (!args.to) return <StatusText.Loading>Sending transaction</StatusText.Loading>

      return <StatusText.Loading>Sending transaction to {args.to}...</StatusText.Loading>
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
        <StatusText.WithIcon>
          <StatusText.Icon icon={Icon} className="text-green-500" />
          <StatusText.Text>Transaction sent: {result}</StatusText.Text>
        </StatusText.WithIcon>
      )
  }
}

const SendTransactionUI = makeAssistantToolUI<SendTransactionParams, SendTransactionResult>({
  toolName: 'sendTransaction',
  render: SendTransactionContent,
})

export default SendTransactionUI
