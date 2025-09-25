import { fromAssetId, isAssetReference, fromChainId } from '@shapeshiftoss/caip'
import type { Asset, GetRateInput, GetRateOutput } from '@shapeshiftoss/types'
import { fromBaseUnit, toBaseUnit, isNativeEvmAsset } from '@shapeshiftoss/utils'
import axios from 'axios'
import type { Address } from 'viem'
import { zeroAddress } from 'viem'

import type { RelayFetchQuoteParams, RelayQuote } from './types'

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
  const originNetworkId = fromChainId(sellAsset.chainId).chainReference
  const destinationNetworkId = fromChainId(buyAsset.chainId).chainReference

  try {
    const { data } = await axios.post<RelayQuote>('https://api.relay.link/quote', {
      user: address,
      recipient: address,
      refundTo: address,
      refundOnOrigin: true,
      originChainId: Number(originNetworkId),
      originCurrency: getRelayAssetAddress(sellAsset),
      destinationCurrency: getRelayAssetAddress(buyAsset),
      destinationChainId: Number(destinationNetworkId),
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
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('[getRelayRate] API request failed:', error.response?.status, error.response?.data || error.message)
    } else {
      console.error('[getRelayRate] Unexpected error:', error)
    }
    throw error
  }
}
