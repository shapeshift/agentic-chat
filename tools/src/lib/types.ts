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
  name: string;
  address: string;
  decimals: number;
}

export interface BebopQuote {
  buyTokens: Record<string, BebopToken>;
  sellTokens: Record<string, BebopToken>;
}

export interface BebopRoute {
  quote: BebopQuote;
}

export interface BebopResponse {
  routes: BebopRoute[];
}
