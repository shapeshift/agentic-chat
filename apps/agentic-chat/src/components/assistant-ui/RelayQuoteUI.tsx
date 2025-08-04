import type { ToolCallContentPartComponent } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { AssetId } from '@shapeshiftoss/caip'
import { AlertCircle, ArrowRightLeft } from 'lucide-react'
import z from 'zod'

import { useAssetsStore } from '../../stores/assets'
import { TextShimmer } from '../TextShimmer'
import { Button } from '../ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

export const relayRateParams = z.object({
  sellAssetId: z.string().describe('The sell AssetID to fetch rate for'),
  buyAssetId: z.string().describe('The buy AssetID to fetch rate for'),
  sellAmountCryptoPrecision: z.string().describe('Amount to sell in human format, e.g. 1 for 1 ETH'),
})

export type RelayRateParams = z.infer<typeof relayRateParams>
export type RelayRateResult = {
  sellAmountCryptoPrecision: string
  buyAmountCryptoPrecision: string
  sellAssetId: AssetId
  buyAssetId: AssetId
  approvalTarget: string | undefined
}

const RelayUiContent: ToolCallContentPartComponent<RelayRateParams, RelayRateResult> = ({
  status,
  result,
  args,
  isError,
}) => {
  const assetsStore = useAssetsStore()
  const sellAsset = assetsStore.assetsById[args.sellAssetId]
  const buyAsset = assetsStore.assetsById[args.buyAssetId]

  switch (status.type) {
    case 'running':
    case 'requires-action':
    case 'incomplete': {
      if (!(args.sellAmountCryptoPrecision && args.buyAssetId)) {
        return <TextShimmer>Getting quote</TextShimmer>
      }

      return (
        <TextShimmer>
          Getting quote for {args.sellAmountCryptoPrecision} {sellAsset?.symbol ?? ''} → {buyAsset?.symbol ?? ''}
        </TextShimmer>
      )
    }
    case 'complete':
      if (isError || !result || typeof result === 'string') {
        return (
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <p className="text-muted-foreground">Failed to fetch quote</p>
          </div>
        )
      }
      return (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-muted-foreground" /> Confirm Swap
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3">
              <Label>Sell Amount</Label>
              <div className="relative">
                <Input className="md:text-lg p-6" value={result.sellAmountCryptoPrecision} readOnly />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  <span>{sellAsset?.symbol ?? ''}</span>
                </div>
              </div>
            </div>
            <div className="grid gap-3 mt-4">
              <Label>Buy Amount</Label>
              <div className="relative">
                <Input className="md:text-lg p-6" value={result.buyAmountCryptoPrecision} readOnly />
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
      )
  }
}
const RelayQuoteUI = makeAssistantToolUI<RelayRateParams, RelayRateResult>({
  toolName: 'relayRate',
  render: RelayUiContent,
})

export default RelayQuoteUI
