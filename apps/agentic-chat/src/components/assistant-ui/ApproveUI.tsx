import { makeAssistantToolUI } from '@assistant-ui/react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { TextShimmer } from '../TextShimmer';

export type ApproveArgs = {
  token: string;
  spender: string;
  amountCryptoPrecision: string;
  chainId: number;
  decimals: number;
};

export type ApproveResult = string; // transaction hash

const ApproveUI = makeAssistantToolUI<ApproveArgs, ApproveResult>({
  toolName: 'approve',
  render: ({ status, result, args, isError }) => {
    switch (status.type) {
      case 'running':
      case 'requires-action':
      case 'incomplete':
        return (
          <TextShimmer>
            Approving {args.amountCryptoPrecision} of {args.token}...
          </TextShimmer>
        );
      case 'complete':
        if (isError) {
          return (
            <div className='flex items-center gap-2'>
              <AlertCircle className='w-4 h-4 text-red-500' />
              <p className='text-muted-foreground'>{result}</p>
            </div>
          );
        }
        return (
          <div className='flex items-center gap-2'>
            <CheckCircle className='w-4 h-4 text-primary' />
            <p className='text-muted-foreground'>
              Approval transaction sent: {result}
            </p>
          </div>
        );
    }
  },
});

export default ApproveUI;
