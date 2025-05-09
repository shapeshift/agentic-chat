import { wagmiConfig } from '@/lib/wagmi-config';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { Dashboard } from './dashboard/page';

const queryClient = new QueryClient();

export function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
