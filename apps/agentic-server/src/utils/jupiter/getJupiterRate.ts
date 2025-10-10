import { fromAssetId } from '@shapeshiftoss/caip'
import type { GetRateInput, GetRateOutput } from '@shapeshiftoss/types'
import { fromBaseUnit, toBaseUnit } from '@shapeshiftoss/utils'
import axios from 'axios'

import type { JupiterQuoteResponse, JupiterSwapRequest, JupiterSwapResponse } from './types.js'

const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote'
const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6/swap'
const DEFAULT_SLIPPAGE_BPS = 50

export const getJupiterRate = async ({
  address,
  buyAsset,
  sellAmountCryptoPrecision,
  sellAsset,
}: GetRateInput): Promise<GetRateOutput> => {
  // Jupiter only supports same-chain Solana swaps, so address is both seller and buyer
  const userSolanaAddress = address
  const { assetReference: inputMint } = fromAssetId(sellAsset.assetId)
  const { assetReference: outputMint } = fromAssetId(buyAsset.assetId)

  const amount = toBaseUnit(sellAmountCryptoPrecision, sellAsset.precision)

  try {
    const quoteParams = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps: DEFAULT_SLIPPAGE_BPS.toString(),
    })

    const { data: quoteResponse } = await axios.get<JupiterQuoteResponse>(
      `${JUPITER_QUOTE_API}?${quoteParams.toString()}`
    )

    const swapRequest: JupiterSwapRequest = {
      quoteResponse,
      userPublicKey: userSolanaAddress,
      wrapAndUnwrapSol: true,
      prioritizationFeeLamports: 'auto',
      dynamicComputeUnitLimit: true,
    }

    const { data: swapResponse } = await axios.post<JupiterSwapResponse>(JUPITER_SWAP_API, swapRequest)

    if (swapResponse.simulationError) {
      throw new Error(`Jupiter swap simulation error: ${swapResponse.simulationError.msg}`)
    }

    const buyAmountCryptoPrecision = fromBaseUnit(quoteResponse.outAmount, buyAsset.precision)

    return {
      approvalTarget: '',
      buyAsset,
      buyAmountCryptoPrecision,
      sellAsset,
      sellAmountCryptoPrecision,
      source: 'jupiter',
      unsignedTx: {
        chainId: sellAsset.chainId,
        data: swapResponse.swapTransaction,
        from: userSolanaAddress,
        to: '',
        value: '0',
      },
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        '[getJupiterRate] API request failed:',
        error.response?.status,
        error.response?.data || error.message
      )
    } else {
      console.error('[getJupiterRate] Unexpected error:', error)
    }
    throw error
  }
}
