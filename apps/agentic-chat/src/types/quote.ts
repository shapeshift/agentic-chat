import { AssetId } from '@shapeshiftoss/caip';

export type TxData = {
  from: string;
  to: string;
  chainId: number;
  value: string;
  data: string;
  gas?: number | null;
  gasPrice?: number | null;
};

export type Quote = {
  sellAmountCryptoPrecision: string;
  buyAmountCryptoPrecision: string;
  sellAssetId: AssetId;
  buyAssetId: AssetId;
  approvalTarget: string | undefined;
  tx: TxData;
  id: string;
};
