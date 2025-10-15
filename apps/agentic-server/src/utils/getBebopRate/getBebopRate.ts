import type { ChainId } from '@shapeshiftoss/caip'
import {
  ethChainId,
  polygonChainId,
  arbitrumChainId,
  baseChainId,
  avalancheChainId,
  optimismChainId,
  bscChainId,
  fromAssetId,
} from '@shapeshiftoss/caip'
import type { Asset, GetRateInput, GetRateOutput } from '@shapeshiftoss/types'
import { getFeeAssetIdByChainId, fromBaseUnit, toBaseUnit } from '@shapeshiftoss/utils'
import axios from 'axios'
import type { Address } from 'viem'
import { getAddress } from 'viem'

import type { BebopResponse } from './types'

const BEBOP_API_KEY = process.env.BEBOP_API_KEY
const BEBOP_ETH_MARKER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

const bebopChainsMap: Record<ChainId, string> = {
  [ethChainId]: 'ethereum',
  [polygonChainId]: 'polygon',
  [arbitrumChainId]: 'arbitrum',
  [baseChainId]: 'base',
  [avalancheChainId]: 'avalanche',
  [optimismChainId]: 'optimism',
  [bscChainId]: 'bsc',
}

const getBebopAssetAddress = (asset: Asset): Address => {
  return getAddress(
    asset.assetId === getFeeAssetIdByChainId(asset.chainId)
      ? BEBOP_ETH_MARKER
      : fromAssetId(asset.assetId).assetReference
  )
}

export const getBebopRate = async ({
  address,
  buyAsset,
  sellAmountCryptoPrecision,
  sellAsset,
}: GetRateInput): Promise<GetRateOutput> => {
  // Bebop only supports same-chain EVM swaps, so address is both seller and buyer
  const userAddress = address
  const bebopNetwork = bebopChainsMap[sellAsset.chainId]
  const buyTokenAddress = getBebopAssetAddress(buyAsset)
  const sellTokenAddress = getBebopAssetAddress(sellAsset)
  const sellAmountBaseUnit = toBaseUnit(sellAmountCryptoPrecision, sellAsset.precision)

  const requestParams = {
    sell_tokens: sellTokenAddress,
    buy_tokens: buyTokenAddress,
    sell_amounts: sellAmountBaseUnit,
    taker_address: userAddress,
    approval_type: 'Standard',
    skip_validation: 'true',
    gasless: 'false',
    source: 'shapeshift',
  }

  try {
    const { data } = await axios.get<BebopResponse>(`https://api.bebop.xyz/router/${bebopNetwork}/v1/quote`, {
      headers: { 'source-auth': BEBOP_API_KEY },
      params: requestParams,
    })

    if (!data.routes?.[0]?.quote) throw new Error('No routes found in Bebop response')

    const quote = data.routes[0].quote
    const buyAmountCryptoBaseUnit = quote.buyTokens[buyTokenAddress].amount.toString()
    const buyAmountCryptoPrecision = fromBaseUnit(buyAmountCryptoBaseUnit, quote.buyTokens[buyTokenAddress].decimals)

    return {
      approvalTarget: quote.approvalTarget,
      buyAsset,
      buyAmountCryptoPrecision,
      sellAsset,
      sellAmountCryptoPrecision,
      source: 'bebop',
      unsignedTx: {
        chainId: sellAsset.chainId,
        data: quote.tx.data,
        from: quote.tx.from,
        to: quote.tx.to,
        value: quote.tx.value,
        ...(quote.tx.gas && { gasLimit: quote.tx.gas }),
      },
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('[getBebopRate] API request failed:', error.response?.status, error.response?.data || error.message)
    } else {
      console.error('[getBebopRate] Unexpected error:', error)
    }
    throw error
  }
}
