import { makeAssistantToolUI } from '@assistant-ui/react';
import { ArrowRightLeft, CheckCircle } from 'lucide-react';
import { TextShimmer } from '../TextShimmer';
import { CollapsableDetails } from './CollapsableDetails';

export type ExecuteSwapArgs = Record<string, never>; // no args
export type ExecuteSwapResult = string; // tx hash

const Icon = ArrowRightLeft;

const ExecuteSwapUI = makeAssistantToolUI<ExecuteSwapArgs, ExecuteSwapResult>({
  toolName: 'executeSwap',
  render: ({ status, result, isError, toolName }) => {
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
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-green-500" />
            <p className="text-muted-foreground">
              Swap transaction sent: {result}
            </p>
          </div>
        );
      default:
        return <TextShimmer>Executing swap...</TextShimmer>;
    }
  },
});

export default ExecuteSwapUI;
