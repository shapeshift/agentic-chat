import { makeAssistantToolUI } from '@assistant-ui/react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { TextShimmer } from '../TextShimmer';

export type ExecuteSwapArgs = Record<string, never>; // no args
export type ExecuteSwapResult = string; // tx hash

const ExecuteSwapUI = makeAssistantToolUI<ExecuteSwapArgs, ExecuteSwapResult>({
  toolName: 'executeSwap',
  render: ({ status, result, isError }) => {
    switch (status.type) {
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
            <p className='text-muted-foreground'>Swap transaction sent: {result}</p>
          </div>
        );
      default:
        return <TextShimmer>Executing swap...</TextShimmer>;
    }
  },
});

export default ExecuteSwapUI;
