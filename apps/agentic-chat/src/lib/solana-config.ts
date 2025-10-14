import { SolanaAdapter } from '@reown/appkit-adapter-solana/react'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'

export const solanaAdapter = new SolanaAdapter({
  wallets: [new PhantomWalletAdapter()],
})
