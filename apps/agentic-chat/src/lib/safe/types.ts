import { createPublicClient, http, fallback } from 'viem'
import * as allChains from 'viem/chains'

import { SUPPORTED_EVM_CHAINS } from '@/lib/chains'

// Matches @safe-global/protocol-kit's Eip1193Provider. Uses `any` for the request
// args so viem WalletClient (which uses narrow method unions) is assignable without casts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SafeProvider = { request: (args: any) => Promise<unknown> }

// Read-only RPC methods that the Safe SDK calls during init/execution.
// These are routed to a public RPC because WalletConnect wallets often
// don't relay read calls properly (e.g. "Missing or invalid parameters").
// Everything NOT in this set goes to the wallet provider (signing, sending,
// eth_chainId for wallet-chain verification, wallet_* methods, etc.).
const PUBLIC_RPC_METHODS = new Set([
  'eth_call',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_getBalance',
  'eth_getTransactionCount',
  'eth_getTransactionReceipt',
  'eth_getTransactionByHash',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_blockNumber',
  'eth_estimateGas',
  'eth_getLogs',
])

// Build a public client with a fallback transport: tries the app's configured
// RPC first, then the chain's default public RPC (e.g. rpc.gnosischain.com).
function getPublicClientWithFallback(chainId: number) {
  const chainConfig = SUPPORTED_EVM_CHAINS.find(c => c.chain.id === chainId)
  const viemChain = Object.values(allChains).find(c => typeof c === 'object' && 'id' in c && c.id === chainId)
  const chain = chainConfig?.chain ?? viemChain
  if (!chain) return undefined

  const configuredUrl = chainConfig?.rpcUrl
  const defaultRpcUrl = viemChain && 'rpcUrls' in viemChain ? viemChain.rpcUrls?.default?.http?.[0] : undefined
  const transports = configuredUrl ? [http(configuredUrl)] : []
  if (defaultRpcUrl && defaultRpcUrl !== configuredUrl) {
    transports.push(http(defaultRpcUrl))
  }
  if (transports.length === 0) transports.push(http())

  return createPublicClient({ chain, transport: fallback(transports) })
}

// Creates a composite provider that routes read-only RPC calls through a
// public RPC (with fallback) and everything else through the wallet provider.
// This avoids issues where WalletConnect doesn't properly relay read-only
// calls like eth_call or eth_getCode.
export function createSafeProvider(chainId: number, walletProvider: SafeProvider): SafeProvider {
  const publicClient = getPublicClientWithFallback(chainId)
  if (!publicClient) return walletProvider

  return {
    request: async (args: { method: string; params?: unknown[] }) => {
      if (PUBLIC_RPC_METHODS.has(args.method)) {
        return publicClient.request(args as Parameters<typeof publicClient.request>[0])
      }
      return walletProvider.request(args)
    },
  }
}
