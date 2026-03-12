import { z } from 'zod'

export const cowSupportedNetworkSchema = z.enum(['ethereum', 'gnosis', 'arbitrum'])

/**
 * CoW Protocol types for limit orders
 */

export type CowOrderStatus = 'open' | 'submitted' | 'fulfilled' | 'cancelled' | 'expired' | 'failed' | 'partiallyFilled'

export interface CowOrder {
  uid: string
  owner: string
  sellToken: string
  buyToken: string
  sellAmount: string
  buyAmount: string
  validTo: number
  status: CowOrderStatus
  executedSellAmount?: string
  executedBuyAmount?: string
  creationDate: string
  kind: 'sell' | 'buy'
  partiallyFillable: boolean
  class: 'limit' | 'market' | 'liquidity'
  signingScheme?: string
}

export interface CowOrderQuote {
  sellToken: string
  buyToken: string
  sellAmount: string
  buyAmount: string
  validTo: number
  appData: string
  feeAmount: string
  kind: 'sell' | 'buy'
  partiallyFillable: boolean
  receiver: string
}

export interface CowEIP712Domain {
  name: string
  version: string
  chainId: number
  verifyingContract: string
}

export interface CowEIP712Types {
  Order: Array<{ name: string; type: string }>
}

export interface CowOrderSigningData {
  domain: CowEIP712Domain
  types: CowEIP712Types
  primaryType: 'Order'
  message: CowOrderQuote
}

export interface CreateCowOrderParams {
  sellToken: string
  buyToken: string
  sellAmount: string
  buyAmount: string
  userAddress: string
  chainId: number
  expirationSeconds: number
  receiver?: string
}

export interface CreateCowOrderResult {
  orderId: string
  orderToSign: CowOrderQuote
  signingData: CowOrderSigningData
  trackingUrl: string
  expiresAt: string
}

// CoW Protocol supported chain IDs
export const COW_SUPPORTED_CHAINS: Record<number, string> = {
  1: 'mainnet',
  100: 'gnosis',
  42161: 'arbitrum_one',
}

// Network name to chain ID mapping (used by limit order tools)
export const NETWORK_TO_CHAIN_ID: Record<string, number> = {
  ethereum: 1,
  gnosis: 100,
  arbitrum: 42161,
}

// Chain ID to network name mapping
export const CHAIN_ID_TO_NETWORK: Record<number, string> = {
  1: 'ethereum',
  100: 'gnosis',
  42161: 'arbitrum',
}

export function isCowSupportedChain(chainId: number): boolean {
  return chainId in COW_SUPPORTED_CHAINS
}

export function getCowExplorerUrl(orderId: string): string {
  return `https://explorer.cow.fi/orders/${orderId}`
}

export function getCowApiUrl(chainId: number): string {
  const network = COW_SUPPORTED_CHAINS[chainId] ?? 'mainnet'
  return `https://api.cow.fi/${network}`
}
