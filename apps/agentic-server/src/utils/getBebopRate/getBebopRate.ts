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

import { DEFAULT_FEE_BPS } from '../../lib/fees/constants'
import { withRetry } from '../retry'

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
    fee: DEFAULT_FEE_BPS,
  }

  try {
    const { data } = await withRetry(() =>
      axios.get<BebopResponse>(`https://api.bebop.xyz/router/${bebopNetwork}/v1/quote`, {
        headers: { 'source-auth': BEBOP_API_KEY },
        params: requestParams,
      })
    )

    if (!data.routes?.[0]?.quote) throw new Error('No routes found in Bebop response')

    const quote = data.routes[0].quote
    const buyToken = quote.buyTokens[buyTokenAddress]
    if (!buyToken) throw new Error('Buy token not found in quote')

    const buyAmountCryptoBaseUnit = buyToken.amount.toString()
    const buyAmountCryptoPrecision = fromBaseUnit(buyAmountCryptoBaseUnit, buyToken.decimals)

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
      networkFeeCryptoPrecision: quote.gasFee.native,
      networkFeeUsd: quote.gasFee.usd.toString(),
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as { error?: { message?: string }; message?: string } | undefined
      const apiMessage = data?.error?.message || data?.message || error.message

      console.error('[getBebopRate] API request failed:', error.response?.status, data || error.message)

      throw new Error(`Bebop: ${apiMessage}`)
    }

    console.error('[getBebopRate] Unexpected error:', error)
    throw new Error(`Bebop: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
