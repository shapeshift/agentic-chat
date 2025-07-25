import { createStep } from '@mastra/core'
import { fromAssetId, isAssetReference, fromChainId } from '@shapeshiftoss/caip'
import { getRateOutput } from '@shapeshiftoss/types'
import type { Asset, GetRateInput, GetRateOutput } from '@shapeshiftoss/types'
import { fromBaseUnit, toBaseUnit, isNativeEvmAsset } from '@shapeshiftoss/utils'
import axios from 'axios'
import type { Address } from 'viem'
import { zeroAddress } from 'viem'

import { getAccountOutput } from '../getAccount'

import type { RelayFetchQuoteParams, RelayQuote } from './types'

export const getRelayRateStep = createStep({
  id: 'getRelayRate',
  description: 'Return a quote for a swap',
  inputSchema: getAccountOutput,
  outputSchema: getRateOutput,
  execute: async ctx => {
    const { address, buyAsset, sellAsset, sellAmountCryptoPrecision } = ctx.getInitData()

    try {
      const rate = await getRelayRate({ address, buyAsset, sellAsset, sellAmountCryptoPrecision })
      console.log('getRelayRate:', { rate })
      return rate
    } catch (err) {
      console.error(`failed to getRelayRate:`, err)
      throw err
    }
  },
})

const getRelayAssetAddress = (asset: Asset): Address => {
  if (isNativeEvmAsset(asset.assetId)) return zeroAddress
  const { assetReference } = fromAssetId(asset.assetId)
  return isAssetReference(assetReference) ? zeroAddress : (assetReference as Address)
}

export const getRelayRate = async ({
  address,
  buyAsset,
  sellAmountCryptoPrecision,
  sellAsset,
}: GetRateInput): Promise<GetRateOutput> => {
  const networkId = fromChainId(sellAsset.chainId).chainReference

  const { data } = await axios.post<RelayQuote>('https://api.relay.link/quote', {
    user: address,
    recipient: address,
    refundTo: address,
    refundOnOrigin: true,
    originChainId: Number(networkId),
    originCurrency: getRelayAssetAddress(sellAsset),
    destinationCurrency: getRelayAssetAddress(buyAsset),
    destinationChainId: Number(networkId),
    tradeType: 'EXACT_INPUT',
    amount: toBaseUnit(sellAmountCryptoPrecision, sellAsset.precision),
    slippageTolerance: undefined,
    appFees: [], // TODO(gomes): affiliate, none for the time being for devving
  } as RelayFetchQuoteParams)

  const buyAmountCryptoBaseUnit = data.details.currencyOut.amount
  const buyAmountCryptoPrecision = fromBaseUnit(buyAmountCryptoBaseUnit, buyAsset.precision)

  const swapSteps = data.steps.filter(step => step.id !== 'approve')
  if (swapSteps.length > 1) throw new Error('Multi-hop not supported for Relay')

  const txData = swapSteps[0].items?.[0]?.data
  if (!txData) throw new Error('No transaction data found in Relay quote')
  if (!txData.to) throw new Error('No "to" address found in Relay quote')
  if (!txData.value) throw new Error('No "value" found in Relay quote')
  if (!txData.data) throw new Error('No "data" found in Relay quote')

  return {
    approvalTarget: txData.to,
    buyAsset,
    buyAmountCryptoPrecision,
    sellAsset,
    sellAmountCryptoPrecision,
    source: 'relay',
    unsignedTx: {
      chainId: sellAsset.chainId,
      data: txData.data,
      from: address,
      to: txData.to,
      value: txData.value,
      ...(txData.gas && { gasLimit: Number(txData.gas) }),
    },
  }
}
