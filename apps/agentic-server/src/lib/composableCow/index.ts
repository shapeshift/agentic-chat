import { fromAssetId } from '@shapeshiftoss/caip'
import { decodeAbiParameters, encodeAbiParameters, encodeFunctionData, keccak256, parseAbiParameters } from 'viem'

import { toChecksumAddress } from '../../utils/addressValidation'

// ComposableCoW contract address (same across all supported chains)
export const COMPOSABLE_COW_ADDRESS = toChecksumAddress('0xfdaFc9d1902f4e0b84f65f49f244b32b31013b74')

// StopLoss handler address from cowprotocol/composable-cow deployments
export const STOP_LOSS_HANDLER_ADDRESS = toChecksumAddress('0x412c36e5011cd2517016d243a2dfb37f73a242e7')

// TWAP handler address from cowprotocol/composable-cow deployments (same across all chains)
export const TWAP_HANDLER_ADDRESS = toChecksumAddress('0x6cF1e9cA41f7611dEf408122793c358a3d11E5a5')

// CoW Settlement contract (for VaultRelayer approvals)
export const COW_SETTLEMENT_ADDRESS = toChecksumAddress('0x9008D19f58AAbD9eD0D60971565AA8510560ab41')

// CurrentBlockTimestampFactory: getValue() returns bytes32(block.timestamp)
// Used with createWithContext() so TWAP orders know when they were created on-chain
export const CURRENT_BLOCK_TIMESTAMP_FACTORY = toChecksumAddress('0x52eD56Da04309Aca4c3FECC595298d80C2f16BAc')

// VaultRelayer address (approvals target, same across all chains)
export const COW_VAULT_RELAYER_ADDRESS = toChecksumAddress('0xc92e8bdf79f0507f65a392b0ab4667716bfe0110')

// CoW Protocol's canonical native asset marker (used in place of native ETH/xDAI address)
export const COW_NATIVE_ASSET_MARKER = toChecksumAddress('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE')

export const DEFAULT_APP_DATA = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`

export function resolveCowTokenAddress(asset: { assetId: string }, isNative: boolean): `0x${string}` {
  if (isNative) return COW_NATIVE_ASSET_MARKER
  return toChecksumAddress(fromAssetId(asset.assetId).assetReference)
}

export interface ConditionalOrderParams {
  handler: `0x${string}`
  salt: `0x${string}`
  staticInput: `0x${string}`
}

// StopLoss handler static data structure (canonical composable-cow deployment)
export interface StopLossStaticData {
  sellToken: `0x${string}`
  buyToken: `0x${string}`
  sellAmount: bigint
  buyAmount: bigint
  appData: `0x${string}`
  receiver: `0x${string}`
  isSellOrder: boolean
  isPartiallyFillable: boolean
  validTo: number // UNIX timestamp — order expires after this
  sellTokenPriceOracle: `0x${string}`
  buyTokenPriceOracle: `0x${string}`
  strike: bigint // scaled to 18 decimals (CoW StopLoss contract normalizes oracle prices to 18 decimals before comparing)
  maxTimeSinceLastOracleUpdate: bigint
}

export interface TwapStaticData {
  sellToken: `0x${string}`
  buyToken: `0x${string}`
  receiver: `0x${string}`
  partSellAmount: bigint
  minPartLimit: bigint
  t0: bigint // start time (0 = start immediately)
  n: bigint // number of parts
  t: bigint // interval between trades in seconds
  span: bigint // time window for each part (0 = full interval)
  appData: `0x${string}`
}

const CONDITIONAL_ORDER_PARAMS_TUPLE = {
  name: 'params',
  type: 'tuple',
  components: [
    { name: 'handler', type: 'address' },
    { name: 'salt', type: 'bytes32' },
    { name: 'staticInput', type: 'bytes' },
  ],
} as const

const COMPOSABLE_COW_ABI = [
  {
    name: 'create',
    type: 'function',
    inputs: [CONDITIONAL_ORDER_PARAMS_TUPLE, { name: 'dispatch', type: 'bool' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'createWithContext',
    type: 'function',
    inputs: [
      CONDITIONAL_ORDER_PARAMS_TUPLE,
      { name: 'factory', type: 'address' },
      { name: 'data', type: 'bytes' },
      { name: 'dispatch', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'remove',
    type: 'function',
    inputs: [{ name: 'singleOrderHash', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

const STOP_LOSS_STATIC_DATA_PARAMS = parseAbiParameters(
  'address sellToken, address buyToken, uint256 sellAmount, uint256 buyAmount, bytes32 appData, address receiver, bool isSellOrder, bool isPartiallyFillable, uint32 validTo, address sellTokenPriceOracle, address buyTokenPriceOracle, int256 strike, uint256 maxTimeSinceLastOracleUpdate'
)

export function encodeStopLossStaticData(data: StopLossStaticData): `0x${string}` {
  return encodeAbiParameters(STOP_LOSS_STATIC_DATA_PARAMS, [
    data.sellToken,
    data.buyToken,
    data.sellAmount,
    data.buyAmount,
    data.appData,
    data.receiver,
    data.isSellOrder,
    data.isPartiallyFillable,
    data.validTo,
    data.sellTokenPriceOracle,
    data.buyTokenPriceOracle,
    data.strike,
    data.maxTimeSinceLastOracleUpdate,
  ])
}

export function decodeStopLossStaticData(staticInput: `0x${string}`): StopLossStaticData {
  const [
    sellToken,
    buyToken,
    sellAmount,
    buyAmount,
    appData,
    receiver,
    isSellOrder,
    isPartiallyFillable,
    validTo,
    sellTokenPriceOracle,
    buyTokenPriceOracle,
    strike,
    maxTimeSinceLastOracleUpdate,
  ] = decodeAbiParameters(STOP_LOSS_STATIC_DATA_PARAMS, staticInput)

  return {
    sellToken: toChecksumAddress(sellToken),
    buyToken: toChecksumAddress(buyToken),
    sellAmount,
    buyAmount,
    appData: appData,
    receiver: toChecksumAddress(receiver),
    isSellOrder,
    isPartiallyFillable,
    validTo,
    sellTokenPriceOracle: toChecksumAddress(sellTokenPriceOracle),
    buyTokenPriceOracle: toChecksumAddress(buyTokenPriceOracle),
    strike,
    maxTimeSinceLastOracleUpdate,
  }
}

const TWAP_STATIC_DATA_PARAMS = parseAbiParameters(
  'address sellToken, address buyToken, address receiver, uint256 partSellAmount, uint256 minPartLimit, uint256 t0, uint256 n, uint256 t, uint256 span, bytes32 appData'
)

export function encodeTwapStaticData(data: TwapStaticData): `0x${string}` {
  return encodeAbiParameters(TWAP_STATIC_DATA_PARAMS, [
    data.sellToken,
    data.buyToken,
    data.receiver,
    data.partSellAmount,
    data.minPartLimit,
    data.t0,
    data.n,
    data.t,
    data.span,
    data.appData,
  ])
}

export function generateOrderSalt(owner: string, sellToken: string, buyToken: string, nonce?: number): `0x${string}` {
  const nonceValue = nonce ?? Date.now()
  const randomSuffix = crypto.getRandomValues(new Uint8Array(16))
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const randomHex = `0x${Array.from(randomSuffix, b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`
  return keccak256(
    encodeAbiParameters(parseAbiParameters('address, address, address, uint256, bytes'), [
      owner as `0x${string}`,
      sellToken as `0x${string}`,
      buyToken as `0x${string}`,
      BigInt(nonceValue),
      randomHex,
    ])
  )
}

export function buildCreateConditionalOrderTx(
  params: ConditionalOrderParams,
  options?: { factory: `0x${string}` }
): {
  to: string
  data: string
  value: string
} {
  const paramsArg = {
    handler: params.handler,
    salt: params.salt,
    staticInput: params.staticInput,
  }

  const data = options?.factory
    ? encodeFunctionData({
        abi: COMPOSABLE_COW_ABI,
        functionName: 'createWithContext',
        args: [paramsArg, options.factory, '0x', true],
      })
    : encodeFunctionData({
        abi: COMPOSABLE_COW_ABI,
        functionName: 'create',
        args: [paramsArg, true],
      })

  return {
    to: COMPOSABLE_COW_ADDRESS,
    data,
    value: '0',
  }
}

export function buildRemoveConditionalOrderTx(orderHash: `0x${string}`): {
  to: string
  data: string
  value: string
} {
  const data = encodeFunctionData({
    abi: COMPOSABLE_COW_ABI,
    functionName: 'remove',
    args: [orderHash],
  })

  return {
    to: COMPOSABLE_COW_ADDRESS,
    data,
    value: '0',
  }
}

// Encode as a tuple to match Solidity's abi.encode(struct) — struct encoding includes
// an extra 32-byte offset for the dynamic `bytes` field that flat parameter encoding omits
const CONDITIONAL_ORDER_PARAMS_ABI = [CONDITIONAL_ORDER_PARAMS_TUPLE] as const

// Compute the order hash that identifies this conditional order on-chain
export function computeConditionalOrderHash(params: ConditionalOrderParams): `0x${string}` {
  return keccak256(encodeAbiParameters(CONDITIONAL_ORDER_PARAMS_ABI, [params]))
}

export { getChainlinkOracle, getSupportedOracleTokens } from './oracles'
export type { ChainlinkFeed } from './oracles'
