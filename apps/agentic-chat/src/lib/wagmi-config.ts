import { http, createConfig } from 'wagmi';
import { arbitrum, mainnet } from 'wagmi/chains';

export const wagmiConfig = createConfig({
  chains: [mainnet, arbitrum],
  transports: {
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
  },
});
