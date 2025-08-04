import type { ToolCallContentPartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import { BadgeCheck } from 'lucide-react'
import z from 'zod'

import { useAssetsStore } from '../../stores/assets'
import { TextShimmer } from '../TextShimmer'

import { CollapsableDetails } from './CollapsableDetails'

const Icon = BadgeCheck

export const approveParamsSchema = z.object({
  assetId: z.string().describe('The token AssetId to approve'),
  spender: z.string().describe('The address that will be approved to spend the tokens'),
  amountCryptoPrecision: z.string().describe('Amount to approve in human format, e.g. 1 for 1 token'),
})

export type ApproveParams = z.infer<typeof approveParamsSchema>
export type ApproveResult = string // Tx hash

type ApproveUiContentProps = Omit<ToolCallContentPartProps<ApproveParams, ApproveResult>, 'args'> & {
  args: Partial<ApproveParams>
}

const ApproveUiContent: React.FC<ApproveUiContentProps> = ({ status, result, args, isError, toolName }) => {
  const assetsStore = useAssetsStore()
  const asset = assetsStore.assetsById[args.assetId ?? '']

  switch (status.type) {
    case 'running':
    case 'requires-action':
    case 'incomplete': {
      if (!(args.amountCryptoPrecision && asset)) return <TextShimmer>Approving token</TextShimmer>

      return (
        <TextShimmer>
          Approving {args.amountCryptoPrecision} of {asset.symbol}...
        </TextShimmer>
      )
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
          <p className="text-muted-foreground">Approval transaction sent: {result}</p>
        </div>
      )
  }
}
const ApproveUI = makeAssistantToolUI<ApproveParams, ApproveResult>({
  toolName: 'approve',
  render: ApproveUiContent,
})

export default ApproveUI
