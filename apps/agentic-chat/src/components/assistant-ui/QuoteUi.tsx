import { makeAssistantToolUI } from '@assistant-ui/react'
import { Wallet } from 'lucide-react'
import z from 'zod'

import { TextShimmer } from '../TextShimmer'

import { CollapsableDetails } from './CollapsableDetails'

const Icon = Wallet

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const swapInput = z.object({
  buyAssetId: z.string().describe('The buy AssetID to fetch rate for'),
  sellAssetId: z.string().describe('The sell AssetID to fetch rate for'),
  sellAmountCryptoPrecision: z.string().describe('Amount to sell in human format, e.g. 1 for 1 ETH'),
})

type SwapInput = z.infer<typeof swapInput>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const quote = z.object({
  buyAssetId: z.string().describe('The buy AssetID to fetch rate for'),
  buyAmountCryptoPrecision: z.string().describe('Amount to sell in human format, e.g. 1 for 1 ETH'),
  sellAssetId: z.string().describe('The sell AssetID to fetch rate for'),
  sellAmountCryptoPrecision: z.string().describe('Amount to sell in human format, e.g. 1 for 1 ETH'),
})

type Quote = z.infer<typeof quote>

const QuoteUi = makeAssistantToolUI<SwapInput, Quote>({
  toolName: 'swapWorkflow',
  render: ({ status, result, args, isError, toolName }) => {
    console.log({ status, result, args, isError, toolName })
    switch (status.type) {
      case 'running':
      case 'requires-action':
      case 'incomplete': {
        return <TextShimmer>Getting quote for {JSON.stringify(args)}...</TextShimmer>
      }
      case 'complete':
        if (isError || !result) {
          return (
            <CollapsableDetails
              title={`An error occurred with ${toolName}`}
              leftIcon={<Icon className="w-4 h-4 text-red-500" />}
            >
              {JSON.stringify(result || 'Failed to fetch quote')}
            </CollapsableDetails>
          )
        }
        return (
          <CollapsableDetails title="Quote Details" leftIcon={<Icon className="w-4 h-4 text-green-500" />}>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </CollapsableDetails>
        )
    }
  },
})

export default QuoteUi
