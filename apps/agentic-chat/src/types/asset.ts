import { AssetId, ChainId } from '@shapeshiftoss/caip';

export type Asset = {
  assetId: AssetId;
  chainId: ChainId;
  symbol: string;
  name: string;
  precision: number;
  icon: string | undefined;
};
