import { http, createConfig } from 'wagmi'

import { SUPPORTED_EVM_CHAINS } from './chains'

const chains = SUPPORTED_EVM_CHAINS.map(c => c.chain) as [
  (typeof SUPPORTED_EVM_CHAINS)[0]['chain'],
  ...(typeof SUPPORTED_EVM_CHAINS)[number]['chain'][],
]

const transports = Object.fromEntries(SUPPORTED_EVM_CHAINS.map(c => [c.chain.id, http(c.rpcUrl)])) as Record<
  (typeof SUPPORTED_EVM_CHAINS)[number]['chain']['id'],
  ReturnType<typeof http>
>

export const wagmiConfig = createConfig({
  chains,
  multiInjectedProviderDiscovery: false,
  transports,
})
