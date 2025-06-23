type AppFee = {
  recipient: string;
  fee: string;
};

type RelayToken = {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
};

type RelayCurrencyData = {
  currency: RelayToken;
  amount: string;
  amountFormatted: string;
  amountUsd: string;
  minimumAmount: string;
};

type RelayFees = {
  gas: RelayCurrencyData;
  relayer: RelayCurrencyData;
  app: RelayCurrencyData;
};

type QuoteDetails = {
  currencyOut: RelayCurrencyData;
  rate: string;
  slippageTolerance: {
    origin: {
      percent: string;
    };
    destination: {
      percent: string;
    };
  };
  timeEstimate: number;
};

type RelayQuoteEvmItemData = {
  to?: string;
  data?: string;
  value?: string;
  gas?: string;
};

type RelayQuoteItem = {
  data?: RelayQuoteEvmItemData;
};

type RelayQuoteStep = {
  id: string;
  requestId: string;
  items?: RelayQuoteItem[];
};

export type RelayFetchQuoteParams = {
  user: string;
  originChainId: number;
  destinationChainId: number;
  originCurrency: string;
  destinationCurrency: string;
  tradeType: 'EXACT_INPUT' | 'EXACT_OUTPUT' | 'EXPECTED_OUTPUT';
  recipient?: string;
  amount?: string;
  referrer?: string;
  refundOnOrigin?: boolean;
  refundTo?: string;
  slippageTolerance?: string;
  appFees?: AppFee[];
};

export type RelayQuote = {
  fees: RelayFees;
  details: QuoteDetails;
  steps: RelayQuoteStep[];
};
