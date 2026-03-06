/**
 * CoW Protocol integration for limit orders
 *
 * CoW orders are off-chain (gasless) - user signs EIP-712 typed data,
 * then the signed order is submitted to CoW's orderbook API.
 */

import type {
  CowEIP712Domain,
  CowEIP712Types,
  CowOrder,
  CowOrderQuote,
  CowOrderSigningData,
  CreateCowOrderParams,
  CreateCowOrderResult,
} from './types'
import { getCowApiUrl, getCowExplorerUrl, isCowSupportedChain } from './types'

// CoW Protocol settlement contract addresses (for EIP-712 domain verification)
export const COW_SETTLEMENT_CONTRACT: Record<number, string> = {
  1: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41',
  100: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41',
  42161: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41',
}

// CoW Protocol VaultRelayer contract address (for token approvals)
// This is the contract that transfers tokens during order settlement
// Same address across all supported chains
export const COW_VAULT_RELAYER_ADDRESS = '0xc92e8bdf79f0507f65a392b0ab4667716bfe0110'

// Default app data hash (empty app data)
const DEFAULT_APP_DATA = '0x0000000000000000000000000000000000000000000000000000000000000000'

// EIP-712 types for CoW orders
const ORDER_TYPE_FIELDS: CowEIP712Types = {
  Order: [
    { name: 'sellToken', type: 'address' },
    { name: 'buyToken', type: 'address' },
    { name: 'receiver', type: 'address' },
    { name: 'sellAmount', type: 'uint256' },
    { name: 'buyAmount', type: 'uint256' },
    { name: 'validTo', type: 'uint32' },
    { name: 'appData', type: 'bytes32' },
    { name: 'feeAmount', type: 'uint256' },
    { name: 'kind', type: 'string' },
    { name: 'partiallyFillable', type: 'bool' },
    { name: 'sellTokenBalance', type: 'string' },
    { name: 'buyTokenBalance', type: 'string' },
  ],
}

function getEIP712Domain(chainId: number): CowEIP712Domain {
  const verifyingContract = COW_SETTLEMENT_CONTRACT[chainId]
  if (!verifyingContract) {
    throw new Error(`No settlement contract for chain ${chainId}`)
  }
  return {
    name: 'Gnosis Protocol',
    version: 'v2',
    chainId,
    verifyingContract,
  }
}

/**
 * Prepare a limit order for signing.
 * Returns the order data and EIP-712 signing data for client-side signing.
 */
export function prepareCowLimitOrder(params: CreateCowOrderParams): CreateCowOrderResult {
  const { sellToken, buyToken, sellAmount, buyAmount, userAddress, chainId, expirationSeconds, receiver } = params

  if (!isCowSupportedChain(chainId)) {
    throw new Error(`Chain ${chainId} is not supported by CoW Protocol. Supported: Ethereum, Gnosis, Arbitrum`)
  }

  const validTo = Math.floor(Date.now() / 1000) + expirationSeconds

  const orderToSign: CowOrderQuote = {
    sellToken,
    buyToken,
    sellAmount,
    buyAmount,
    validTo,
    appData: DEFAULT_APP_DATA,
    feeAmount: '0', // Limit orders have 0 fee (surplus goes to solvers)
    kind: 'sell',
    partiallyFillable: true, // Allow partial fills for better execution
    receiver: receiver || userAddress,
  }

  const signingData: CowOrderSigningData = {
    domain: getEIP712Domain(chainId),
    types: ORDER_TYPE_FIELDS,
    primaryType: 'Order',
    message: {
      ...orderToSign,
      // EIP-712 message includes additional fields
      sellTokenBalance: 'erc20',
      buyTokenBalance: 'erc20',
    } as CowOrderQuote & { sellTokenBalance: string; buyTokenBalance: string },
  }

  // Generate a placeholder orderId (actual ID assigned after submission)
  const placeholderOrderId = `pending-${Date.now()}`

  return {
    orderId: placeholderOrderId,
    orderToSign,
    signingData,
    trackingUrl: getCowExplorerUrl(placeholderOrderId),
    expiresAt: new Date(validTo * 1000).toISOString(),
  }
}

/**
 * Submit a signed order to CoW Protocol orderbook.
 * Note: Currently the client handles submission directly via useLimitOrderExecution.
 * This function is available for future server-side submission workflows.
 */
export async function submitCowOrder(
  chainId: number,
  order: CowOrderQuote,
  signature: string,
  signingScheme: 'eip712' | 'ethsign' = 'eip712'
): Promise<string> {
  const apiUrl = getCowApiUrl(chainId)

  const orderPayload = {
    sellToken: order.sellToken,
    buyToken: order.buyToken,
    receiver: order.receiver,
    sellAmount: order.sellAmount,
    buyAmount: order.buyAmount,
    validTo: order.validTo,
    appData: order.appData,
    feeAmount: order.feeAmount,
    kind: order.kind,
    partiallyFillable: order.partiallyFillable,
    sellTokenBalance: 'erc20',
    buyTokenBalance: 'erc20',
    signingScheme,
    signature,
    from: order.receiver, // owner of the order
  }

  const response = await fetch(`${apiUrl}/api/v1/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderPayload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to submit order to CoW: ${errorText}`)
  }

  // Response is the order UID as a string
  const orderId = await response.text()
  return orderId.replace(/"/g, '') // Remove quotes if present
}

/**
 * Get orders for a user address from CoW Protocol.
 */
export async function getCowOrders(
  userAddress: string,
  chainId: number,
  options: { limit?: number; offset?: number } = {}
): Promise<CowOrder[]> {
  const apiUrl = getCowApiUrl(chainId)
  const { limit = 50, offset = 0 } = options

  const response = await fetch(`${apiUrl}/api/v1/account/${userAddress}/orders?limit=${limit}&offset=${offset}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to fetch orders from CoW: ${errorText}`)
  }

  return response.json() as Promise<CowOrder[]>
}

/**
 * Get a specific order by ID.
 */
export async function getCowOrder(orderId: string, chainId: number): Promise<CowOrder> {
  const apiUrl = getCowApiUrl(chainId)

  const response = await fetch(`${apiUrl}/api/v1/orders/${orderId}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to fetch order from CoW: ${errorText}`)
  }

  return response.json() as Promise<CowOrder>
}

/**
 * Prepare order cancellation signing data.
 * CoW cancellations also require EIP-712 signature.
 */
export function prepareCowOrderCancellation(
  orderId: string,
  chainId: number
): {
  domain: CowEIP712Domain
  types: { OrderCancellations: Array<{ name: string; type: string }> }
  message: { orderUids: string[] }
} {
  return {
    domain: getEIP712Domain(chainId),
    types: {
      OrderCancellations: [{ name: 'orderUids', type: 'bytes[]' }],
    },
    message: {
      orderUids: [orderId],
    },
  }
}

/**
 * Submit order cancellation to CoW Protocol.
 */
export async function cancelCowOrder(
  orderId: string,
  chainId: number,
  signature: string,
  signingScheme: 'eip712' | 'ethsign' = 'eip712'
): Promise<void> {
  const apiUrl = getCowApiUrl(chainId)

  const response = await fetch(`${apiUrl}/api/v1/orders/${orderId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      signature,
      signingScheme,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to cancel order: ${errorText}`)
  }
}

export * from './types'
