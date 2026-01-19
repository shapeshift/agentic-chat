import type { useWalletConnection } from '@/hooks/useWalletConnection'

// EIP-712 signing data interface (compatible with CoW Protocol)
// Using generic types to accommodate various EIP-712 structured data formats
interface Eip712SigningData {
  domain: object
  types: object
  primaryType: string
  message: object
}

// Shared EIP-712 signing helper for CoW Protocol operations
export async function signTypedDataWithWallet(
  evmWallet: NonNullable<ReturnType<typeof useWalletConnection>['evmWallet']>,
  signingData: Eip712SigningData
): Promise<string> {
  const walletClient = await evmWallet.getWalletClient()

  // Type assertions needed: viem's signTypedData expects specific EIP-712 type structures
  // that differ from CoW Protocol's API response format
  const signature = await walletClient.signTypedData({
    domain: signingData.domain as Parameters<typeof walletClient.signTypedData>[0]['domain'],
    types: signingData.types as unknown as Parameters<typeof walletClient.signTypedData>[0]['types'],
    primaryType: signingData.primaryType,
    message: signingData.message as unknown as Record<string, unknown>,
  })

  return signature
}
