import {
  makeAssistantToolUI,
  ToolCallContentPartComponent,
} from '@assistant-ui/react';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { AlertCircle, ArrowRightLeft } from 'lucide-react';
import { TextShimmer } from '../TextShimmer';
import { Button } from '../ui/button';
import { useAssetsStore } from '../../stores/assets';
import { RelayRateParams, RelayRateResult } from '../../tools/relayRate';

const RelayUiContent: ToolCallContentPartComponent<
  RelayRateParams,
  RelayRateResult
> = ({ status, result, args, isError }) => {
  const assetsStore = useAssetsStore();
  const sellAsset = assetsStore.assetsById[args.sellAssetId];
  const buyAsset = assetsStore.assetsById[args.buyAssetId];

  switch (status.type) {
    case 'running':
    case 'requires-action':
    case 'incomplete': {
      if (!(args.sellAmountCryptoPrecision && args.buyAssetId)) {
        return <TextShimmer>Getting quote</TextShimmer>;
      }

      return (
        <TextShimmer>
          Getting quote for {args.sellAmountCryptoPrecision}{' '}
          {sellAsset?.symbol ?? ''} → {buyAsset?.symbol ?? ''}
        </TextShimmer>
      );
    }
    case 'complete':
      if (isError || !result || typeof result === 'string') {
        return (
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <p className="text-muted-foreground">Failed to fetch quote</p>
          </div>
        );
      }
      return (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />{' '}
              Confirm Swap
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3">
              <Label>Sell Amount</Label>
              <div className="relative">
                <Input
                  className="md:text-lg p-6"
                  value={result.sellAmountCryptoPrecision}
                  readOnly
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  <span>{sellAsset?.symbol ?? ''}</span>
                </div>
              </div>
            </div>
            <div className="grid gap-3 mt-4">
              <Label>Buy Amount</Label>
              <div className="relative">
                <Input
                  className="md:text-lg p-6"
                  value={result.buyAmountCryptoPrecision}
                  readOnly
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  <span>{buyAsset?.symbol ?? ''}</span>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button>Confirm Swap</Button>
          </CardFooter>
        </Card>
      );
  }
};
const RelayQuoteUI = makeAssistantToolUI<RelayRateParams, RelayRateResult>({
  toolName: 'relayRate',
  render: RelayUiContent,
});

export default RelayQuoteUI;
