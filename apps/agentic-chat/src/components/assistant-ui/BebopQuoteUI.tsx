import { makeAssistantToolUI } from '@assistant-ui/react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { ArrowRightLeft } from 'lucide-react';


// Types for bebopRate tool args and result
export type BebopRateArgs = {
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

export type BebopRateResult = {
  sellAmountCryptoPrecision: string;
  buyAmountCryptoPrecision: string;
  sellAsset: {
    symbol: string;
  };
  buyAsset: {
    symbol: string;
  };
  approvalTarget: string;
};

const BebopQuoteUI = makeAssistantToolUI<BebopRateArgs, BebopRateResult>({
  toolName: 'bebopRate',
  render: ({ result }) => {
    if (typeof result === 'string') return null;
    if (!result) return null;
    return (
      <Card className='mt-4'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'><ArrowRightLeft className='w-4 h-4 text-muted-foreground' /> Trade</CardTitle>
        </CardHeader>
        <CardContent className='grid gap-4'>
          <div className="grid gap-3">
            <Label>Sell Amount</Label>
            <div className='relative'>
              <Input className='md:text-lg p-6' value={result.sellAmountCryptoPrecision} readOnly />
              <div className='absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground'>
                <span>{result.sellAsset.symbol}</span>
              </div>
            </div>
          </div>
          <div className='grid gap-3 mt-4'>
            <Label>Buy Amount</Label>
            <div className='relative'>
              <Input className='md:text-lg p-6' value={result.buyAmountCryptoPrecision} readOnly />
              <div className='absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground'>
                <span>{result.buyAsset.symbol}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  },
});

export default BebopQuoteUI;
