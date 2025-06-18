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

const GetAllowanceUI = makeAssistantToolUI<
  GetAllowanceArgs,
  GetAllowanceResult
>({
  toolName: 'getAllowance',
  render: ({ status, result, args, isError, toolName }) => {
    switch (status.type) {
      case 'complete':
        if (isError) {
          return (
            <CollapsableDetails
              title={`An Error Occured with ${toolName}`}
              leftIcon={<AlertCircle className="w-4 h-4 text-red-500" />}
            >
              {result}
            </CollapsableDetails>
          );
        }
        return (
          <CollapsableDetails
            title="Token allowance"
            leftIcon={<CheckCircle className="w-4 h-4 text-primary" />}
          >
            <pre>{result}</pre>
          </CollapsableDetails>
        );
      default:
        return (
          <TextShimmer>Fetching allowance for {args.token}...</TextShimmer>
        );
    }
  },
});

export default GetAllowanceUI;
