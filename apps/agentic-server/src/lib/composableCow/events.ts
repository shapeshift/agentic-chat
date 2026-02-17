import { getViemClient } from '@shapeshiftoss/utils'
import { createPublicClient, getAddress, http, parseAbiItem } from 'viem'
import type { PublicClient } from 'viem'
import { mainnet, gnosis, arbitrum } from 'viem/chains'

import type { ConditionalOrderParams } from './index'
import { COMPOSABLE_COW_ADDRESS, STOP_LOSS_HANDLER_ADDRESS } from './index'

export interface ConditionalOrderCreatedEvent {
  params: ConditionalOrderParams
  blockNumber: bigint
  transactionHash: `0x${string}`
}

const CONDITIONAL_ORDER_CREATED_ABI = parseAbiItem(
  'event ConditionalOrderCreated(address indexed owner, (address handler, bytes32 salt, bytes staticInput) params)'
)

const PUBLIC_RPC_CLIENTS: Record<number, PublicClient> = {
  1: createPublicClient({ chain: mainnet, transport: http('https://ethereum-rpc.publicnode.com') }),
  100: createPublicClient({ chain: gnosis, transport: http('https://gnosis-rpc.publicnode.com') }),
  42161: createPublicClient({ chain: arbitrum, transport: http('https://arbitrum-one-rpc.publicnode.com') }),
}

const DEFAULT_BLOCKS_PER_CHUNK = 50_000n
const BLOCKS_PER_CHUNK: Record<number, bigint> = {
  1: DEFAULT_BLOCKS_PER_CHUNK,
  100: DEFAULT_BLOCKS_PER_CHUNK,
  42161: 500_000n, // Arbitrum: indexed lookup on specific contract + owner topic is efficient for large ranges
}
const MAX_CONCURRENT_CHUNKS = 10
const ONE_MONTH_BLOCKS: Record<number, bigint> = {
  1: 216_000n, // ~1 month at 12s/block
  100: 518_000n, // ~1 month at 5s/block
  42161: 10_500_000n, // ~1 month at 0.25s/block
}

function getPublicClient(chainId: number): PublicClient {
  const client = PUBLIC_RPC_CLIENTS[chainId]
  if (!client) throw new Error(`No public RPC client for chainId: ${chainId}`)
  return client
}

export async function getConditionalOrderCreatedEvents(
  safeAddress: string,
  chainId: number
): Promise<ConditionalOrderCreatedEvent[]> {
  const client = getPublicClient(chainId)
  const currentBlock = await client.getBlockNumber()
  const lookbackBlocks = ONE_MONTH_BLOCKS[chainId] ?? 216_000n
  const fromBlock = currentBlock > lookbackBlocks ? currentBlock - lookbackBlocks : 0n
  const chunkSize = BLOCKS_PER_CHUNK[chainId] ?? DEFAULT_BLOCKS_PER_CHUNK

  const ownerAddress = safeAddress as `0x${string}`

  const chunks: Array<{ from: bigint; to: bigint }> = []
  for (let start = fromBlock; start <= currentBlock; start += chunkSize) {
    const end = start + chunkSize - 1n > currentBlock ? currentBlock : start + chunkSize - 1n
    chunks.push({ from: start, to: end })
  }

  const events: ConditionalOrderCreatedEvent[] = []

  for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_CHUNKS) {
    const batch = chunks.slice(i, i + MAX_CONCURRENT_CHUNKS)
    const results = await Promise.all(
      batch.map(chunk =>
        client.getLogs({
          address: COMPOSABLE_COW_ADDRESS,
          event: CONDITIONAL_ORDER_CREATED_ABI,
          args: { owner: ownerAddress },
          fromBlock: chunk.from,
          toBlock: chunk.to,
        })
      )
    )

    for (const logs of results) {
      for (const log of logs) {
        if (!log.transactionHash || log.blockNumber === null) continue

        const params = log.args.params
        if (!params) continue

        if (getAddress(params.handler) !== STOP_LOSS_HANDLER_ADDRESS) continue

        events.push({
          params: {
            handler: getAddress(params.handler),
            salt: params.salt,
            staticInput: params.staticInput,
          },
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
        })
      }
    }
  }

  return events
}

const SINGLE_ORDERS_ABI = [
  {
    name: 'singleOrders',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'orderHash', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const

export async function isConditionalOrderActive(
  ownerAddress: string,
  orderHash: `0x${string}`,
  chainId: number
): Promise<boolean> {
  const caipChainId = `eip155:${chainId}`
  const client = getViemClient(caipChainId)

  const result = await client.readContract({
    address: COMPOSABLE_COW_ADDRESS,
    abi: SINGLE_ORDERS_ABI,
    functionName: 'singleOrders',
    args: [ownerAddress as `0x${string}`, orderHash],
  })

  return result
}

export async function getBlockTimestamp(blockNumber: bigint, chainId: number): Promise<number> {
  const client = getPublicClient(chainId)
  const block = await client.getBlock({ blockNumber })
  return Number(block.timestamp)
}
