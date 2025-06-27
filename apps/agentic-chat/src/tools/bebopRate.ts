import {
  arbitrumChainId,
  avalancheChainId,
  baseChainId,
  binanceChainId,
  ethChainId,
  fromAssetId,
  optimismChainId,
  polygonChainId,
} from '@shapeshiftoss/caip'
import type { AssetId, ChainId } from '@shapeshiftoss/caip'
import type { BebopQuote, BebopResponse } from '@shapeshiftoss/types'
import { fromBaseUnit, toBaseUnit } from '@shapeshiftoss/utils'
import type { Address } from 'viem'
import { getAddress } from 'viem'
import z from 'zod'

import type { AssetsStore } from '../stores/assets'

const BEBOP_ETH_MARKER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

export const bebopRateParams = z.object({
  sellAssetId: z.string().describe('The sell AssetID to fetch rate for'),
  buyAssetId: z.string().describe('The buy AssetID to fetch rate for'),
  sellAmountCryptoPrecision: z.string().describe('Amount to sell in human format, e.g. 1 for 1 ETH'),
})

export type BebopRateParams = z.infer<typeof bebopRateParams>
export type BebopRateResult = {
  sellAmountCryptoPrecision: string
  buyAmountCryptoPrecision: string
  sellAssetId: AssetId
  buyAssetId: AssetId
  approvalTarget: string
}

export const getBebopRate = async ({
  sellAssetId,
  buyAssetId,
  sellAmountCryptoPrecision,
  fromAddress,
  setBebopQuote,
  assetsStore,
}: BebopRateParams & {
  fromAddress: Address
  setBebopQuote: (bebopQuote: BebopQuote) => void
  assetsStore: AssetsStore
}): Promise<BebopRateResult> => {
  const sellAsset = assetsStore.assetsById[sellAssetId]
  const buyAsset = assetsStore.assetsById[buyAssetId]

  if (!(sellAsset && buyAsset)) {
    throw new Error('AssetIds not found')
  }

  const chainId = fromAssetId(sellAssetId).chainId
  const bebopChainsMap: Record<ChainId, string> = {
    [ethChainId]: 'ethereum',
    [polygonChainId]: 'polygon',
    [arbitrumChainId]: 'arbitrum',
    [baseChainId]: 'base',
    [avalancheChainId]: 'avalanche',
    [optimismChainId]: 'optimism',
    [binanceChainId]: 'bsc',
  }
  const bebopNetwork = bebopChainsMap[chainId]

  const sellAmountCryptoBaseUnit = toBaseUnit(sellAmountCryptoPrecision, sellAsset.precision)

  // Convert ETH symbol to Bebop's ETH marker address
  const sellTokenAddress = getAddress(
    sellAsset.symbol.trim().toUpperCase() === 'ETH' ? BEBOP_ETH_MARKER : fromAssetId(sellAsset.assetId).assetReference
  )
  const buyTokenAddress = getAddress(
    buyAsset.symbol.trim().toUpperCase() === 'ETH' ? BEBOP_ETH_MARKER : fromAssetId(buyAsset.assetId).assetReference
  )

  const env = import.meta?.env ? import.meta.env : process.env

  const BEBOP_API_KEY = env.VITE_BEBOP_API_KEY || env.BEBOP_API_KEY

  const url = `https://api.bebop.xyz/router/${bebopNetwork}/v1/quote`
  const takerAddress = fromAddress
  const reqParams = new URLSearchParams({
    sell_tokens: sellTokenAddress,
    buy_tokens: buyTokenAddress,
    sell_amounts: sellAmountCryptoBaseUnit,
    taker_address: takerAddress,
    approval_type: 'Standard',
    skip_validation: 'true',
    gasless: 'false',
    source: 'shapeshift',
  })

  const fullUrl = `${url}?${reqParams.toString()}`
  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'source-auth': BEBOP_API_KEY,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch Bebop rate: ${response.statusText}`)
  }

  const data = (await response.json()) as BebopResponse

  if (!data.routes?.[0]?.quote) {
    throw new Error('No routes found in Bebop response')
  }

  const quote = data.routes[0].quote

  setBebopQuote(quote)

  const buyAmountCryptoBaseUnit = quote.buyTokens[buyTokenAddress].amount.toString()
  const buyAmountCryptoPrecision = fromBaseUnit(buyAmountCryptoBaseUnit, quote.buyTokens[buyTokenAddress].decimals)

  const content = {
    sellAmountCryptoPrecision,
    buyAmountCryptoPrecision,
    sellAssetId,
    buyAssetId,
    approvalTarget: quote.approvalTarget,
  }

  return content
}
