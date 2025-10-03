export interface JupiterQuoteResponse {
  inputMint: string
  inAmount: string
  outputMint: string
  outAmount: string
  otherAmountThreshold: string
  swapMode: string
  slippageBps: number
  platformFee: {
    amount: string
    feeBps: number
  } | null
  priceImpactPct: string
  routePlan: Array<{
    swapInfo: {
      ammKey: string
      label: string
      inputMint: string
      outputMint: string
      inAmount: string
      outAmount: string
      feeAmount: string
      feeMint: string
    }
    percent: number
  }>
  contextSlot?: number
  timeTaken?: number
}

export interface JupiterSwapRequest {
  quoteResponse: JupiterQuoteResponse
  userPublicKey: string
  wrapAndUnwrapSol?: boolean
  useSharedAccounts?: boolean
  feeAccount?: string
  prioritizationFeeLamports?: number | 'auto'
  asLegacyTransaction?: boolean
  useTokenLedger?: boolean
  destinationTokenAccount?: string
  dynamicComputeUnitLimit?: boolean
  skipUserAccountsRpcCalls?: boolean
}

export interface JupiterSwapResponse {
  swapTransaction: string
  lastValidBlockHeight: number
  prioritizationFeeLamports?: number
  computeUnitLimit?: number
  prioritizationType?: {
    computeBudget?: {
      microLamports: number
      estimatedMicroLamports: number
    }
  }
  dynamicSlippageReport?: unknown
  simulationError?: {
    msg: string
  }
}
