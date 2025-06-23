import { AssetId } from "@shapeshiftoss/caip"
import { Hex } from "viem";

export type TxData = {
  from: string
  to: string
  chainId: number;
  value: Hex
  data: Hex
  gas?: number | null;
  gasPrice?: number | null;
}

export type Quote = {
    sellAmountCryptoPrecision: string
    buyAmountCryptoPrecision: string
    sellAssetId: AssetId
    buyAssetId: AssetId
    approvalTarget: string | undefined,
    tx: TxData
}
