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
  const { chainNamespace: originChainNamespace, chainReference: originChainReference } = fromChainId(sellAsset.chainId)
  const { chainNamespace: destinationChainNamespace, chainReference: destinationChainReference } = fromChainId(
    buyAsset.chainId
  )

  if (originChainNamespace !== 'eip155') {
    throw new Error(`[getRelayRate] Unsupported origin chain namespace: ${originChainNamespace}`)
  }
  if (destinationChainNamespace !== 'eip155') {
    throw new Error(`[getRelayRate] Unsupported destination chain namespace: ${destinationChainNamespace}`)
  }

  const originChainId = Number(originChainReference)
  const destinationChainId = Number(destinationChainReference)

  if (!Number.isFinite(originChainId)) {
    throw new Error(`[getRelayRate] Invalid origin chain reference: ${originChainReference}`)
  }
  if (!Number.isFinite(destinationChainId)) {
    throw new Error(`[getRelayRate] Invalid destination chain reference: ${destinationChainReference}`)
  }

  try {
    const { data } = await axios.post<RelayQuote>('https://api.relay.link/quote', {
      user: address,
      recipient: address,
      refundTo: address,
      refundOnOrigin: true,
      originChainId,
      originCurrency: getRelayAssetAddress(sellAsset),
      destinationCurrency: getRelayAssetAddress(buyAsset),
      destinationChainId,
      tradeType: 'EXACT_INPUT',
      amount: toBaseUnit(sellAmountCryptoPrecision, sellAsset.precision),
      slippageTolerance: undefined,
      appFees: [], // TODO(gomes): affiliate, none for the time being for devving
    } as RelayFetchQuoteParams)

    const buyAmountCryptoBaseUnit = data.details.currencyOut.amount
    const buyAmountCryptoPrecision = fromBaseUnit(buyAmountCryptoBaseUnit, buyAsset.precision)

    const swapSteps = data.steps.filter(step => step.id !== 'approve')
    if (swapSteps.length === 0) throw new Error('No swap execution steps found in Relay quote')
    if (swapSteps.length > 1) throw new Error('Multi-hop not supported for Relay')

    const txData = swapSteps[0]?.items?.[0]?.data
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
