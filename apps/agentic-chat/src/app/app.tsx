import { createAppKit } from '@reown/appkit/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Routes, Route, Navigate } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'

import { networks } from '@/lib/appkit'
import { solanaAdapter } from '@/lib/solana-config'
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
    adapters: [wagmiAdapter, solanaAdapter],
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
        <Routes>
          <Route path="/" element={<Navigate to="/chats" replace />} />
          <Route path="/chats" element={<Dashboard />} />
          <Route path="/chats/:conversationId" element={<Dashboard />} />
        </Routes>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default App
