/**
 * Standalone verification script for on-chain order hash computation.
 *
 * Run: cd apps/agentic-server && bun src/lib/composableCow/__tests__/verifyOrderHash.ts
 *
 * Verifies whether our computeConditionalOrderHash matches the ComposableCoW
 * contract's hash() function, and checks on-chain singleOrders state.
 */

import { createPublicClient, decodeEventLog, http, parseAbiItem } from 'viem'
import { mainnet } from 'viem/chains'

import { toChecksumAddress } from '../../../utils/addressValidation'
import { COMPOSABLE_COW_ADDRESS, computeConditionalOrderHash } from '../index'

// Known test data from parent investigation (shapeshift-agentic-9ke)
const SAFE_ADDRESS = toChecksumAddress('0xcFD4f9b00935A660283987d8Ec1011c27d8F8fDe')
const CREATION_TX = '0x932518081b82084cfb1de6b55ceda33931ed40a1f9fbf8aa13f26ff2482500b7'
const CLAIMED_HASH = '0x6747c6831e5c693eaf2ed4e16f2a25d951c0db7bf69ae650a0eb4e378fcf8ec3'

const CONDITIONAL_ORDER_CREATED_EVENT = parseAbiItem(
  'event ConditionalOrderCreated(address indexed owner, (address handler, bytes32 salt, bytes staticInput) params)'
)

const COMPOSABLE_COW_HASH_ABI = [
  {
    name: 'hash',
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
    ],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'pure',
  },
] as const

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

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://ethereum-rpc.publicnode.com'),
})

async function main() {
  console.log('=== Order Hash Verification Script ===\n')
  console.log(`Safe address: ${SAFE_ADDRESS}`)
  console.log(`Creation tx:  ${CREATION_TX}`)
  console.log(`Claimed hash: ${CLAIMED_HASH}\n`)

  // Step 1: Fetch event data from creation tx
  console.log('--- Step 1: Fetch ConditionalOrderCreated event from creation tx ---')
  const receipt = await client.getTransactionReceipt({ hash: CREATION_TX })
  console.log(`Transaction status: ${receipt.status}`)
  console.log(`Block number: ${receipt.blockNumber}`)
  console.log(`Logs count: ${receipt.logs.length}`)

  let eventParams: { handler: `0x${string}`; salt: `0x${string}`; staticInput: `0x${string}` } | null = null

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: [CONDITIONAL_ORDER_CREATED_EVENT],
        data: log.data,
        topics: log.topics,
      })
      if (decoded.eventName === 'ConditionalOrderCreated') {
        const args = decoded.args as {
          owner: `0x${string}`
          params: { handler: `0x${string}`; salt: `0x${string}`; staticInput: `0x${string}` }
        }
        console.log(`\nEvent found!`)
        console.log(`  Owner:       ${args.owner}`)
        console.log(`  Handler:     ${args.params.handler}`)
        console.log(`  Salt:        ${args.params.salt}`)
        console.log(`  StaticInput: ${args.params.staticInput.slice(0, 66)}...`)
        eventParams = {
          handler: toChecksumAddress(args.params.handler),
          salt: args.params.salt,
          staticInput: args.params.staticInput,
        }
      }
    } catch {
      // Not our event, skip
    }
  }

  if (!eventParams) {
    console.error('\nERROR: ConditionalOrderCreated event not found in transaction!')
    process.exit(1)
  }

  // Step 2: Compute hash locally using our (fixed) function
  console.log('\n--- Step 2: Compute hash using computeConditionalOrderHash ---')
  const ourHash = computeConditionalOrderHash(eventParams)
  console.log(`Our computed hash: ${ourHash}`)
  console.log(`Claimed hash:     ${CLAIMED_HASH}`)
  console.log(
    `Match (ours vs claimed): ${ourHash === CLAIMED_HASH ? 'YES' : 'NO (expected — claimed used old buggy flat encoding)'}`
  )

  // Step 3: Call contract's hash() function
  console.log('\n--- Step 3: Call contract hash() function ---')
  const contractHash = await client.readContract({
    address: COMPOSABLE_COW_ADDRESS,
    abi: COMPOSABLE_COW_HASH_ABI,
    functionName: 'hash',
    args: [eventParams],
  })
  console.log(`Contract hash:     ${contractHash}`)
  console.log(`Our hash:          ${ourHash}`)
  console.log(`Match (ours vs contract): ${ourHash === contractHash ? 'YES' : 'NO — MISMATCH!'}`)

  // Step 4: Check on-chain singleOrders state
  console.log('\n--- Step 4: Check on-chain singleOrders state ---')

  const hashesToCheck = new Set<`0x${string}`>([ourHash, CLAIMED_HASH, contractHash])

  for (const hash of hashesToCheck) {
    const isActive = await client.readContract({
      address: COMPOSABLE_COW_ADDRESS,
      abi: SINGLE_ORDERS_ABI,
      functionName: 'singleOrders',
      args: [SAFE_ADDRESS, hash],
    })
    console.log(`singleOrders(${SAFE_ADDRESS}, ${hash}) = ${isActive}`)
  }

  // Step 5: Summary
  console.log('\n--- Step 5: Summary ---')
  const allMatch = ourHash === CLAIMED_HASH && ourHash === contractHash
  if (allMatch) {
    console.log('All hashes match. Hash computation is correct.')
  } else {
    console.log('HASH MISMATCH DETECTED:')
    if (ourHash !== CLAIMED_HASH) console.log(`  - Our hash differs from claimed hash`)
    if (ourHash !== contractHash) console.log(`  - Our hash differs from contract hash`)
    if (CLAIMED_HASH !== contractHash) console.log(`  - Claimed hash differs from contract hash`)
  }

  console.log('\nDone.')
}

main().catch(err => {
  console.error('Script failed:', err)
  process.exit(1)
})
