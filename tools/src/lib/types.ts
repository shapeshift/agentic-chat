import { Address, Hex } from "viem";

export interface PortalsToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  logoURI: string;
  volumeUsd7d: number;
  priceUsd: number;
}

export interface PortalsResponse {
  tokens: PortalsToken[];
  total: number;
}

export interface TokenSearchResult {
  tokens: PortalsToken[];
  total: number;
}

export interface BebopToken {
  amount: string;
  symbol: string;
  name?: string;
  address?: Address;
  decimals: number;
  priceUsd?: number;
  minimumAmount?: string;
  price?: number;
  priceBeforeFee?: number;
  amountBeforeFee?: string;
  deltaFromExpected?: number;
}

export interface BebopTxData {
  chainId: number;
  from: Address;
  to: Address;
  value: Hex;
  data: Hex;
  gas?: number | null;
  gasPrice?: number | null;
}

export interface BebopQuote {
  type: string;
  status: string;
  quoteId: string;
  chainId: number;
  approvalType: string;
  nativeToken: string;
  taker: string;
  receiver: string;
  expiry: number;
  slippage: number;
  gasFee: {
    native: string;
    usd: number;
  };
  buyTokens: Record<string, BebopToken>;
  sellTokens: Record<string, BebopToken>;
  settlementAddress: string;
  approvalTarget: string;
  requiredSignatures: string[];
  priceImpact?: number | null;
  warnings: Array<{ code: number; message: string }>;
  tx: BebopTxData;
  hooksHash: string;
  solver: string;
}

export interface BebopRoute {
  quote: BebopQuote;
}

export interface BebopResponse {
  routes: BebopRoute[];
}
