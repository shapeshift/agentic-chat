import { makeAssistantToolUI } from '@assistant-ui/react';
import { Wallet } from 'lucide-react';
import { CollapsableDetails } from './CollapsableDetails';
import { TextShimmer } from '../TextShimmer';
import { GetAccountParams, GetAccountResult } from '../../tools/getAccount';

const Icon = Wallet;

const GetAccountUI = makeAssistantToolUI<GetAccountParams, GetAccountResult>({
  toolName: 'getAccount',
  render: ({ status, result, args, isError, toolName }) => {
    switch (status.type) {
      case 'complete':
        if (isError) {
          return (
            <CollapsableDetails
              title={`An error occurred with ${toolName}`}
              leftIcon={<Icon className="w-4 h-4 text-red-500" />}
            >
              {JSON.stringify(result)}
            </CollapsableDetails>
          );
        }
        return (
          <CollapsableDetails
            title="Account details"
            leftIcon={<Icon className="w-4 h-4 text-green-500" />}
          >
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </CollapsableDetails>
        );
      default:
        return <TextShimmer>Getting account for {args.network}...</TextShimmer>;
    }
  },
});

export default GetAccountUI;
