import { makeAssistantToolUI } from '@assistant-ui/react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { CollapsableDetails } from './CollapsableDetails';
import { TextShimmer } from '../TextShimmer';
import { ConnectWallet } from '../connect-wallet';


// Types for bebopRate tool args and result
export type GetAccountArgs = {
  network: string;
};

export type GetAccountResult = string;

const GetAccountUI = makeAssistantToolUI<GetAccountArgs, GetAccountResult>({
  toolName: 'getAccount',
  render: ({ status, result, args, isError }) => {
    switch (status.type) {
      case "running":
        return <TextShimmer>Getting account for {args.network}...</TextShimmer>;
      case "requires-action":
        return <TextShimmer>Getting account for {args.network}...</TextShimmer>;
      case "incomplete":
        return <TextShimmer>Getting account for {args.network}...</TextShimmer>;
      case "complete":
        if (isError) {
          return (
            <div className='flex items-center gap-2'>
              <AlertCircle className='w-4 h-4 text-red-500' />
              <p className='text-muted-foreground'>{result}</p>
            </div>
          );
        }
        return (
          <CollapsableDetails title='Account details' leftIcon={<CheckCircle className='w-4 h-4 text-primary' />}>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </CollapsableDetails>
      );
    }
  },
});

export default GetAccountUI;
