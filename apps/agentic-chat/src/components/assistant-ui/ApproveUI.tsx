import { makeAssistantToolUI } from '@assistant-ui/react';
import { AlertCircle, BadgeCheck, CheckCircle, ThumbsUp } from 'lucide-react';
import { TextShimmer } from '../TextShimmer';
import { CollapsableDetails } from './CollapsableDetails';

export type ApproveArgs = {
  token: string;
  spender: string;
  amountCryptoPrecision: string;
  chainId: number;
  decimals: number;
};

export type ApproveResult = string; // transaction hash

const Icon = BadgeCheck

const ApproveUI = makeAssistantToolUI<ApproveArgs, ApproveResult>({
  toolName: 'approve',
  render: ({ status, result, args, isError, toolName }) => {
    switch (status.type) {
      case 'complete':
        if (isError) {
          return (
            <CollapsableDetails title={`An Error Occured with ${toolName}`} leftIcon={<Icon className='w-4 h-4 text-red-500' />}>
              {result}
            </CollapsableDetails>
          );
        }
        return (
          <div className='flex items-center gap-2'>
            <Icon className='w-4 h-4 text-green-500' />
            <p className='text-muted-foreground'>
              Approval transaction sent: {result}
            </p>
          </div>
        );
      default:
        return (
          <TextShimmer>
            Approving {args.amountCryptoPrecision} of {args.token}...
          </TextShimmer>
        );
    }
  },
});

export default ApproveUI;
