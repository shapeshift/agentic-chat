import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'
import type { GetRateInput, GetRateOutput } from '@shapeshiftoss/types'
import { fromBaseUnit, toBaseUnit } from '@shapeshiftoss/utils'
import axios from 'axios'

import { getChainAdapter } from '../chains/relayAdapterRegistry'

import type { RelayFetchQuoteParams, RelayQuote } from './types'

export const getRelayRate = async ({
  address,
  recipientAddress,
  buyAsset,
  sellAmountCryptoPrecision,
  sellAsset,
}: GetRateInput & { recipientAddress?: string }): Promise<GetRateOutput> => {
  const sellAdapter = getChainAdapter(sellAsset.chainId)
  const buyAdapter = getChainAdapter(buyAsset.chainId)

  const originChainId = sellAdapter.getRelayChainId(sellAsset.chainId)
  const destinationChainId = buyAdapter.getRelayChainId(buyAsset.chainId)

  // For cross-chain swaps, use separate addresses. For same-chain, use the same address.
  const sellAddress = address
  const buyAddress = recipientAddress || address

  try {
    const { data } = await axios.post<RelayQuote>('https://api.relay.link/quote', {
      user: sellAddress,
      recipient: buyAddress,
      refundTo: sellAddress,
      refundOnOrigin: true,
      originChainId,
      originCurrency: sellAdapter.getRelayAssetAddress(sellAsset),
      destinationCurrency: buyAdapter.getRelayAssetAddress(buyAsset),
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

    const { chainNamespace } = fromChainId(sellAsset.chainId)

    if (chainNamespace === CHAIN_NAMESPACE.Solana) {
      return {
        approvalTarget: '',
        buyAsset,
        buyAmountCryptoPrecision,
        sellAsset,
        sellAmountCryptoPrecision,
        source: 'relay',
        unsignedTx: {
          chainId: sellAsset.chainId,
          data: JSON.stringify(txData),
          from: sellAddress,
          to: '',
          value: '0',
        },
      }
    }

    if (chainNamespace === CHAIN_NAMESPACE.Evm) {
      const evmTxData = txData as { to?: string; data?: string; value?: string; gas?: string }

      if (!evmTxData.to) throw new Error('No "to" address found in Relay quote')
      if (!evmTxData.value) throw new Error('No "value" found in Relay quote')
      if (!evmTxData.data) throw new Error('No "data" found in Relay quote')

      return {
        approvalTarget: evmTxData.to,
        buyAsset,
        buyAmountCryptoPrecision,
        sellAsset,
        sellAmountCryptoPrecision,
        source: 'relay',
        unsignedTx: {
          chainId: sellAsset.chainId,
          data: evmTxData.data,
          from: sellAddress,
          to: evmTxData.to,
          value: evmTxData.value,
          ...(evmTxData.gas && { gasLimit: Number(evmTxData.gas) }),
        },
      }
    }

    throw new Error(`Unsupported chain namespace: ${chainNamespace}`)
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('[getRelayRate] API request failed:', error.response?.status, error.response?.data || error.message)
    } else {
      console.error('[getRelayRate] Unexpected error:', error)
    }
    throw error
  }
}
