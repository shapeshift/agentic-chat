import { makeAssistantToolUI } from '@assistant-ui/react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { TextShimmer } from '../TextShimmer';

export type SendTransactionArgs = {
  to: string;
  valueCryptoPrecision: string;
  data: string;
  chainId: number;
};

export type SendTransactionResult = string; // tx hash

const SendTransactionUI = makeAssistantToolUI<SendTransactionArgs, SendTransactionResult>({
  toolName: 'sendTransaction',
  render: ({ status, result, args, isError }) => {
    switch (status.type) {
      case 'running':
      case 'requires-action':
      case 'incomplete':
        return (
          <TextShimmer>
            Sending transaction to {args.to}...
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
            <p className='text-muted-foreground'>Transaction sent: {result}</p>
          </div>
        );
    }
  },
});

export default SendTransactionUI;
