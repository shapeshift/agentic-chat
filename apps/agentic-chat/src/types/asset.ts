import { AssetId, ChainId } from '@agentic-chat/caip';

export type Asset = {
  assetId: AssetId;
  chainId: ChainId;
  symbol: string;
  name: string;
  precision: string;
  icon: string | undefined;
};
