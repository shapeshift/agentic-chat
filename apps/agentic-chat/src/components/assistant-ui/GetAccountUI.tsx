import { makeAssistantToolUI } from '@assistant-ui/react';
import { AlertCircle, CheckCircle, Wallet } from 'lucide-react';
import { CollapsableDetails } from './CollapsableDetails';
import { TextShimmer } from '../TextShimmer';

const Icon = Wallet;
// Types for bebopRate tool args and result
export type GetAccountArgs = {
  network: string;
};

export type GetAccountResult = string;

const GetAccountUI = makeAssistantToolUI<GetAccountArgs, GetAccountResult>({
  toolName: 'getAccount',
  render: ({ status, result, args, isError, toolName }) => {
    switch (status.type) {
      case 'complete':
        if (isError) {
          return (
            <CollapsableDetails
              title={`An Error Occured with ${toolName}`}
              leftIcon={<Icon className="w-4 h-4 text-red-500" />}
            >
              {result}
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
