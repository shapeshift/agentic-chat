import { makeAssistantToolUI } from '@assistant-ui/react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { TextShimmer } from '../TextShimmer';
import { CollapsableDetails } from './CollapsableDetails';

export type GetAllowanceArgs = {
  token: string;
  decimals: number;
  spender: string;
  chainId: number;
};

export type GetAllowanceResult = string; // allowance in human units

const GetAllowanceUI = makeAssistantToolUI<GetAllowanceArgs, GetAllowanceResult>({
  toolName: 'getAllowance',
  render: ({ status, result, args, isError }) => {
    switch (status.type) {
      case 'running':
      case 'requires-action':
      case 'incomplete':
        return (
          <TextShimmer>
            Fetching allowance for {args.token}...
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
          <CollapsableDetails
            title='Token allowance'
            leftIcon={<CheckCircle className='w-4 h-4 text-primary' />}
          >
            <pre>{result}</pre>
          </CollapsableDetails>
        );
    }
  },
});

export default GetAllowanceUI;
