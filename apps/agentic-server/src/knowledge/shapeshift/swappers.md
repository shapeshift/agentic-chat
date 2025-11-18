# ShapeShift Swap Providers

ShapeShift integrates **12 swap providers and aggregators** to offer users the best rates and widest asset coverage across all supported chains.

## Integrated Swap Providers

### 1. THORChain
- **Type:** Cross-chain native swap protocol
- **Capabilities:**
  - Native cross-chain swaps (no wrapped tokens)
  - Supports longtail assets
  - Swaps between BTC, ETH, AVAX, LTC, DOGE, BCH, ATOM, and more
  - Decentralized liquidity pools
- **Chains:** Bitcoin, Ethereum, Avalanche, Litecoin, Dogecoin, Bitcoin Cash, Cosmos, BNB Chain

### 2. MAYAChain
- **Type:** Cross-chain native swap protocol (THORChain fork)
- **Capabilities:**
  - Similar to THORChain
  - Native cross-chain swaps
  - Independent validator set
  - Uses CACAO token for liquidity pairing
- **Chains:** Multiple Layer 1 blockchains

### 3. 0x (Zrx)
- **Type:** DEX aggregator
- **Capabilities:**
  - Aggregates liquidity from multiple DEXs
  - Gas-optimized swaps
  - Thousands of tokens
- **Chains:** Ethereum, Polygon, Arbitrum, Optimism, Base, Avalanche, BNB Smart Chain

### 4. CoW Swap
- **Type:** MEV-protected DEX aggregator
- **Capabilities:**
  - Batch auctions and coincidence of wants matching
  - MEV protection
  - Routes through Uniswap, Balancer, Curve, and more
  - Powers ShapeShift's limit orders feature
  - Gasless trading after initial approval
- **Chains:** Ethereum, Gnosis, Arbitrum One

### 5. Jupiter
- **Type:** Solana DEX aggregator
- **Capabilities:**
  - Routes across all major Solana liquidity sources
  - Best execution for Solana token swaps
  - Lightning-fast, low-cost swaps
- **Chains:** Solana only

### 6. Chainflip
- **Type:** Cross-chain swap protocol
- **Capabilities:**
  - Native cross-chain swaps without wrapping
  - Supports Bitcoin and other major chains
  - True native-to-native execution
- **Chains:** Ethereum, Bitcoin, Solana, and more

### 7. Relay
- **Type:** Cross-chain bridge aggregator
- **Capabilities:**
  - Instant, low-cost bridging
  - Cross-chain execution
  - Minimal gas costs
- **Chains:** Multiple chains

### 8. Portals
- **Type:** DeFi protocol aggregator (any-to-any swaps)
- **Capabilities:**
  - **Enables one-click DeFi** entry/exit
  - Swap into/out of LP tokens, vault tokens, liquid staking derivatives, yield tokens
  - Routes through 40+ DeFi protocols
  - Complex position management simplified
  - Examples: Exit Curve 3CRV → BTC, Yearn yvWBTC → ETH, Lido stETH → USDC
- **Chains:** Multiple EVM chains
- **Note:** This is how ShapeShift accesses 40+ DeFi protocols without direct integration of each

### 9. ButterSwap
- **Type:** Swap provider
- **Capabilities:**
  - Cross-chain swaps
  - Fast settlement, transparent fees
- **Chains:** Multiple blockchains

### 10. Bebop
- **Type:** Order flow aggregator
- **Capabilities:**
  - Aggregates order flow
  - Optimized execution
- **Chains:** Multiple chains

### 11. NEAR Intents
- **Type:** Intent-based swap protocol
- **Capabilities:**
  - Cross-chain swaps
  - Simplified user experience
- **Chains:** Multiple chains

### 12. Arbitrum Bridge
- **Type:** Official Arbitrum bridge
- **Capabilities:**
  - Native Arbitrum bridging
  - ETH and token transfers between Ethereum and Arbitrum
- **Chains:** Ethereum ↔ Arbitrum One

## How Swap Routing Works

ShapeShift automatically:
1. Fetches quotes from all applicable swap providers
2. Compares rates, fees, and execution speed
3. Recommends the best option to the user
4. Executes the swap through the selected provider

Users see:
- Multiple quote options
- Estimated gas fees
- Price impact
- Expected output amount
- Execution time

## Accessing 40+ DeFi Protocols

While ShapeShift directly integrates 12 swap providers, the **Portals integration** enables access to 40+ DeFi protocols including:
- **Yield Vaults:** Yearn, Beefy
- **Liquid Staking:** Lido, Rocket Pool, EtherFi
- **Lending:** Aave, Compound, Morpho
- **DEXs:** Uniswap, Curve, Balancer (via 0x, CoW, Portals)
- **And many more**

This means users can enter/exit complex DeFi positions in one click without ShapeShift directly integrating each protocol.
