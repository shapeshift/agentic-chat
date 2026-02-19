import {
  decodeAbiParameters,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  keccak256,
  parseAbiParameters,
} from 'viem'

// ComposableCoW contract address (same across all supported chains)
export const COMPOSABLE_COW_ADDRESS = getAddress('0xfdaFc9d1902f4e0b84f65f49f244b32b31013b74')

// StopLoss handler address from cowprotocol/composable-cow deployments
export const STOP_LOSS_HANDLER_ADDRESS = getAddress('0x412c36e5011cd2517016d243a2dfb37f73a242e7')

// TWAP handler address from cowprotocol/composable-cow deployments (same across all chains)
export const TWAP_HANDLER_ADDRESS = getAddress('0x6cF1e9cA41f7611dEf408122793c358a3d11E5a5')

// CoW Settlement contract (for VaultRelayer approvals)
export const COW_SETTLEMENT_ADDRESS = getAddress('0x9008D19f58AAbD9eD0D60971565AA8510560ab41')

// VaultRelayer address (approvals target, same across all chains)
export const COW_VAULT_RELAYER_ADDRESS = getAddress('0xc92e8bdf79f0507f65a392b0ab4667716bfe0110')

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
  strike: bigint // strike price scaled to sell oracle's decimals (typically 8 for Chainlink crypto/USD feeds)
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

// ABI fragment for ComposableCoW.create()
const COMPOSABLE_COW_ABI = [
  {
    name: 'create',
    type: 'function',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'handler', type: 'address' },
          { name: 'salt', type: 'bytes32' },
          { name: 'staticInput', type: 'bytes' },
        ],
      },
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

const STOP_LOSS_STATIC_DATA_PARAMS = parseAbiParameters(
  'address sellToken, address buyToken, uint256 sellAmount, uint256 buyAmount, bytes32 appData, address receiver, bool isSellOrder, bool isPartiallyFillable, uint32 validTo, address sellTokenPriceOracle, address buyTokenPriceOracle, int256 strike, uint256 maxTimeSinceLastOracleUpdate'
)

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
  }
}

export function encodeTwapStaticData(data: TwapStaticData): `0x${string}` {
  return encodeAbiParameters(
    parseAbiParameters(
      'address sellToken, address buyToken, address receiver, uint256 partSellAmount, uint256 minPartLimit, uint256 t0, uint256 n, uint256 t, uint256 span, bytes32 appData'
    ),
    [
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
    ]
  )
}

export function generateOrderSalt(owner: string, sellToken: string, buyToken: string, nonce?: number): `0x${string}` {
  const nonceValue = nonce ?? Date.now()
  return keccak256(
    encodeAbiParameters(parseAbiParameters('address, address, address, uint256'), [
      owner as `0x${string}`,
      sellToken as `0x${string}`,
      buyToken as `0x${string}`,
      BigInt(nonceValue),
    ])
  )
}

export function buildCreateConditionalOrderTx(params: ConditionalOrderParams): {
  to: string
  data: string
  value: string
} {
  const data = encodeFunctionData({
    abi: COMPOSABLE_COW_ABI,
    functionName: 'create',
    args: [
      {
        handler: params.handler,
        salt: params.salt,
        staticInput: params.staticInput,
      },
      true, // dispatch = true → emit ConditionalOrderCreated event for watchtower
    ],
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
const CONDITIONAL_ORDER_PARAMS_ABI = [
  {
    type: 'tuple',
    components: [
      { name: 'handler', type: 'address' },
      { name: 'salt', type: 'bytes32' },
      { name: 'staticInput', type: 'bytes' },
    ],
  },
] as const

// Compute the order hash that identifies this conditional order on-chain
export function computeConditionalOrderHash(params: ConditionalOrderParams): `0x${string}` {
  return keccak256(encodeAbiParameters(CONDITIONAL_ORDER_PARAMS_ABI, [params]))
}

export { getChainlinkOracle, getSupportedOracleTokens } from './oracles'
export type { ChainlinkFeed } from './oracles'
