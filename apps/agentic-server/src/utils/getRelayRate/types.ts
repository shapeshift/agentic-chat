type AppFee = {
  recipient: string
  fee: string
}

type RelayToken = {
  chainId: number
  address: string
  symbol: string
  name: string
  decimals: number
}

type RelayCurrencyData = {
  currency: RelayToken
  amount: string
  amountFormatted: string
  amountUsd: string
  minimumAmount: string
}

type RelayFees = {
  gas: RelayCurrencyData
  relayer: RelayCurrencyData
  app: RelayCurrencyData
}

type QuoteDetails = {
  currencyOut: RelayCurrencyData
  rate: string
  slippageTolerance: {
    origin: {
      percent: string
    }
    destination: {
      percent: string
    }
  }
  timeEstimate: number
}

type RelayQuoteEvmItemData = {
  to?: string
  data?: string
  value?: string
  gas?: string
}

export type RelaySolanaInstruction = {
  keys: {
    pubkey: string
    isSigner: boolean
    isWritable: boolean
  }[]
  data: string
  programId: string
}

type RelayQuoteSolanaItemData = {
  instructions: RelaySolanaInstruction[]
  addressLookupTableAddresses: string[]
}

type RelayQuoteItem = {
  data?: RelayQuoteEvmItemData | RelayQuoteSolanaItemData
}

export const isRelayQuoteEvmItemData = (
  item: RelayQuoteEvmItemData | RelayQuoteSolanaItemData
): item is RelayQuoteEvmItemData => {
  return 'to' in item && 'data' in item && 'value' in item
}

export const isRelayQuoteSolanaItemData = (
  item: RelayQuoteEvmItemData | RelayQuoteSolanaItemData
): item is RelayQuoteSolanaItemData => {
  return 'instructions' in item
}

type RelayQuoteStep = {
  id: string
  requestId: string
  items?: RelayQuoteItem[]
}

export type RelayFetchQuoteParams = {
  user: string
  originChainId: number
  destinationChainId: number
  originCurrency: string
  destinationCurrency: string
  tradeType: 'EXACT_INPUT' | 'EXACT_OUTPUT' | 'EXPECTED_OUTPUT'
  recipient?: string
  amount?: string
  referrer?: string
  refundOnOrigin?: boolean
  refundTo?: string
  slippageTolerance?: string
  appFees?: AppFee[]
}

export type RelayQuote = {
  fees: RelayFees
  details: QuoteDetails
  steps: RelayQuoteStep[]
}
