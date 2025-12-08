import { createAppKit } from '@reown/appkit/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { WagmiProvider } from 'wagmi'

import { useAutoNetworkSwitch } from '@/hooks/useAutoNetworkSwitch'
import { useWalletAnalytics } from '@/hooks/useWalletAnalytics'
import { networks } from '@/lib/appkit'
import { solanaAdapter } from '@/lib/solana-config'
import { wagmiConfig, wagmiAdapter } from '@/lib/wagmi-config'

import { Dashboard } from './dashboard/page'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})

const metadata = {
  name: 'Agentic Chat',
  description: 'ShapeShift Agentic Chat',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://chat.shapeshift.com',
  icons: ['https://app.shapeshift.com/icon-512x512.png'],
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

function AppContent() {
  useWalletAnalytics()
  useAutoNetworkSwitch()

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/chats" replace />} />
      <Route path="/chats" element={<Dashboard />} />
      <Route path="/chats/:conversationId" element={<Dashboard />} />
    </Routes>
  )
}

function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AppContent />
        <Toaster
          theme="dark"
          closeButton
          toastOptions={{
            classNames: {
              closeButton: '!right-0 !left-auto !translate-x-[50%] !-translate-y-[25%]',
            },
          }}
        />
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default App
