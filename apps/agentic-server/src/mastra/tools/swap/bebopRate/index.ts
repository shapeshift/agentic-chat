import { createStep } from '@mastra/core'
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
import { getRateOutput } from '@shapeshiftoss/types'
import { getFeeAssetByChainId, fromBaseUnit, toBaseUnit } from '@shapeshiftoss/utils'
import axios from 'axios'
import type { Address } from 'viem'
import { getAddress } from 'viem'

import type { swapWorkflowInput } from '../../../workflows/swap'
import { getAccountOutput } from '../../portfolio/getAccount'

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

export const getBebopRateStep = createStep({
  id: 'getBebopRate',
  description: 'Return a quote for a swap',
  inputSchema: getAccountOutput,
  outputSchema: getRateOutput,
  execute: async ctx => {
    const { address, buyAsset, sellAsset, sellAmountCryptoPrecision } = ctx.getInitData<typeof swapWorkflowInput>()

    try {
      const rate = await getBebopRate({ address, buyAsset, sellAsset, sellAmountCryptoPrecision })
      return rate
    } catch (err) {
      console.error(`failed to getBebopRate:`, err)
      throw err
    }
  },
})

const getBebopAssetAddress = (asset: Asset): Address => {
  return getAddress(
    asset.assetId === getFeeAssetByChainId(asset.chainId) ? BEBOP_ETH_MARKER : fromAssetId(asset.assetId).assetReference
  )
}

const getBebopRate = async ({
  address,
  buyAsset,
  sellAmountCryptoPrecision,
  sellAsset,
}: GetRateInput): Promise<GetRateOutput> => {
  const bebopNetwork = bebopChainsMap[sellAsset.chainId]

  const buyTokenAddress = getBebopAssetAddress(buyAsset)

  const { data } = await axios.get<BebopResponse>(`https://api.bebop.xyz/router/${bebopNetwork}/v1/quote`, {
    headers: { 'source-auth': BEBOP_API_KEY },
    params: {
      sell_tokens: getBebopAssetAddress(sellAsset),
      buy_tokens: buyTokenAddress,
      sell_amounts: toBaseUnit(sellAmountCryptoPrecision, sellAsset.precision),
      taker_address: address,
      approval_type: 'Standard',
      skip_validation: 'true',
      gasless: 'false',
      source: 'shapeshift',
    },
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
}
