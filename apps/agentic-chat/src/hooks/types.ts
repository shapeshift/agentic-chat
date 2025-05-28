import { AssetId, ChainId } from '@shapeshiftoss/caip';

export interface Asset {
  name: string;
  symbol: string;
  precision: number;
  chainId: ChainId;
  assetId: AssetId;
}
