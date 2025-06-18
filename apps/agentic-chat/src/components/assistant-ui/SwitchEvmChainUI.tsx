import { makeAssistantToolUI } from '@assistant-ui/react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { AlertCircle, ArrowRightLeft, CheckCircle } from 'lucide-react';
import { TextShimmer } from '../TextShimmer';


// Types for bebopRate tool args and result
export type SwitchEvmChainArgs = {
  chain: string;
  fromAsset: {
    address: string;
    decimals: number;
    symbol?: string;
  };
  toAsset: {
    address: string;
    decimals: number;
    symbol: string;
  };
  sellAmountCryptoPrecision: string;
  fromAddress: string;
};

export type SwitchEvmChainResult = string;

const SwitchEvmChainUI = makeAssistantToolUI<SwitchEvmChainArgs, SwitchEvmChainResult>({
  toolName: 'switchEvmChain',
  render: ({ status, result, isError }) => {
    switch (status.type) {
      case "running":
      case "requires-action":
      case "incomplete":
        return <TextShimmer>Switching chain...</TextShimmer>;
      case "complete":
        if (isError) {
          return <div className='flex items-center gap-2'>
            <AlertCircle className='w-4 h-4 text-red-500' />
            <p className='text-muted-foreground'>Error switching chain</p>
          </div>;
        }
        return (
          <div className='flex items-center gap-2'>
          <CheckCircle className='w-4 h-4 text-primary' />
            <p className='text-muted-foreground'>Chain switched to {result}</p>
          </div>
        );

    }
  },
});

export default SwitchEvmChainUI;
