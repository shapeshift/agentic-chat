import { createAppKit } from '@reown/appkit/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'

import AssistantRuntimeProvider from '@/app/AssistantRuntimeProvider'
import { networks } from '@/lib/appkit'
import { wagmiConfig, wagmiAdapter } from '@/lib/wagmi-config'

import { Dashboard } from './dashboard/page'

const queryClient = new QueryClient()

const metadata = {
  name: 'Agentic Chat',
  description: 'ShapeShift Agentic Chat',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://chat.shapeshift.com',
  icons: ['https://chat.shapeshift.com/favicon.ico'],
}

// Initialize AppKit
if (import.meta.env.VITE_PROJECT_ID) {
  createAppKit({
    adapters: [wagmiAdapter],
    projectId: import.meta.env.VITE_PROJECT_ID,
    networks,
    metadata,
    features: {
      swaps: false,
    },
  })
}

function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AssistantRuntimeProvider>
          <Dashboard />
        </AssistantRuntimeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default App
