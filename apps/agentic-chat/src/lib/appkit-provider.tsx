'use client';

import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { createAppKit } from '@reown/appkit/react';
import { config, networks, projectId, wagmiAdapter } from './appkit';
import { mainnet } from '@reown/appkit/networks';

const queryClient = new QueryClient();

const metadata = {
  name: 'Agentic Chat',
  description: 'ShapeShift Agentic Chat',
  url:
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://chat.shapeshift.com',
  icons: ['https://chat.shapeshift.com/favicon.ico'],
};

// Initialize AppKit
if (!projectId) {
  console.error('AppKit Initialization Error: Project ID is missing.');
} else {
  createAppKit({
    adapters: [wagmiAdapter],
    projectId,
    networks,
    defaultNetwork: mainnet,
    metadata,
    features: { analytics: true },
  });
}

export default function AppKitProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
