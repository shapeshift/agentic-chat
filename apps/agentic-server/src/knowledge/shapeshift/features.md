# ShapeShift Platform Features

## Trading Features

### Swap/Trade
- **Multi-provider routing:** Automatically finds best rates across 12 swap providers
- **Quote comparison:** See multiple options before executing
- **Slippage protection:** Configurable slippage tolerance
- **Cross-chain swaps:** Trade between different blockchains natively
- **Multi-hop routing:** Optimized routing through multiple pools for best execution
- **Gas fee estimates:** See total cost before confirming
- **Price impact display:** Understand how your trade affects market price

### Limit Orders
- **Supported Chains:** Ethereum, Gnosis, Arbitrum One
- **How it works:**
  - Set desired price for a trade
  - Order executes automatically when price is reached
  - Gasless trading after initial token approval
  - MEV protection included
- **Features:**
  - Create limit orders
  - Track open orders
  - Cancel orders
  - Order history and notifications
  - Custom expiration times
- **Benefit:** No need to monitor prices constantly; set and forget

## Fiat On-Ramp & Off-Ramp

ShapeShift integrates **4 fiat ramp providers** for buying and selling crypto with traditional currency:

### 1. Coinbase
- **Type:** Buy & Sell
- **Features:**
  - Trusted brand
  - Wide geographic coverage
  - Multiple payment methods
  - KYC required (via Coinbase)

### 2. OnRamper
- **Type:** Aggregator (Buy & Sell)
- **Features:**
  - Aggregates multiple fiat ramp services
  - Compare quotes from different providers
  - Choose best rate for your region
  - Multiple payment methods
  - KYC required (via chosen provider)

### 3. Banxa
- **Type:** Buy & Sell
- **Features:**
  - Global coverage
  - Minimum $50 for sell transactions
  - Multiple fiat currencies supported
  - Credit/debit card, bank transfer
  - KYC required (via Banxa)

### 4. Mt Pelerin
- **Type:** Buy & Sell
- **Features:**
  - **No KYC required** (for certain limits)
  - Non-US users
  - Minimum ~$55 for sell transactions
  - Privacy-focused option
  - Swiss-based company

### Fiat Ramp Features
- **Quote comparison:** See rates from all providers
- **Multiple fiat currencies:** USD, EUR, GBP, and more (varies by provider)
- **Multiple payment methods:** Credit card, debit card, bank transfer, etc.
- **Buy crypto:** Deposit fiat, receive crypto directly to your wallet
- **Sell crypto:** Send crypto, receive fiat in bank account
- **Important:** KYC requirements vary by provider and are managed by the provider, not ShapeShift

## Portfolio Tracking

### Multi-Chain Portfolio View
- **Unified dashboard:** See all assets across all 19 supported chains
- **Real-time balances:** Updated balance tracking
- **Fiat value conversion:** View portfolio value in your preferred currency
- **Asset breakdown:** Detailed view of each holding
- **Transaction history:** Track all your transactions across chains

### DeFi Position Tracking
- Track LP token positions
- Monitor vault token values
- View liquid staking derivative balances
- Track yield-earning positions
- **Examples:**
  - Yearn vault positions
  - Aave lending/borrowing
  - Curve LP positions
  - Lido stETH holdings
  - And 40+ other DeFi protocols

### Portfolio Analytics
- **Total value:** Sum of all holdings in fiat
- **Chain distribution:** See which chains hold most value
- **Asset allocation:** Breakdown by asset type
- **Historical performance:** Track value over time
- **Profit/loss tracking:** Understand gains and losses

## One-Click DeFi

### What is It?
Instant entry and exit from complex DeFi positions without manual multi-step processes.

### Capabilities
- **LP Token Swaps:** Exit liquidity pool positions in one click
  - Example: Curve 3CRV (DAI/USDT/USDC) → BTC
- **Vault Token Management:** Reallocate vault holdings easily
  - Example: Yearn yvWBTC → ETH
- **Liquid Staking Derivatives:** Swap LSDs for other assets
  - Example: Lido stETH → USDC
- **Yield Token Conversion:** Move between yield-bearing assets
  - Example: Aave aDAI → Compound cDAI

### How It Works
1. You hold a complex DeFi position (LP token, vault token, etc.)
2. Want to exit or reallocate to a different asset
3. ShapeShift automatically:
   - Withdraws from the DeFi protocol
   - Swaps underlying assets
   - Delivers your desired final asset
4. All in one transaction, one click

### Supported Protocols
- **Yield Vaults:** Yearn, Beefy
- **Liquid Staking:** Lido, Rocket Pool, EtherFi, Jito
- **Lending:** Aave, Compound, Morpho, Euler, Seamless, Sparklend
- **DEXs:** Uniswap, Curve, Balancer, PancakeSwap
- **And 30+ more DeFi protocols**

## Advanced Features

### Custom Slippage
- Set maximum acceptable slippage percentage
- Protect against price impact
- Balance between execution certainty and best price

### Custom Gas Settings
- Adjust gas price for faster/cheaper transactions
- Priority fee customization
- Gas estimation before execution

### Multi-Account Support
- Manage multiple wallet addresses
- Switch between accounts easily
- Separate portfolio views per account

### Watch-Only Mode
- Track wallets without connecting
- Monitor addresses you don't own
- Portfolio tracking for cold wallets

### Custom Token Imports
- Add any token not in default list
- Import by contract address
- Full functionality for custom tokens

## User Experience Features

### Quote Aggregation
- Fetch quotes from all relevant swap providers
- Display sorted by best rate
- Show gas costs, price impact, estimated output
- Let user choose provider or accept recommendation

### Transaction Notifications
- In-app notifications for pending transactions
- Completion alerts
- Failed transaction warnings
- Limit order fill notifications

### Multi-Language Support
- Platform available in multiple languages
- Growing language support

### Mobile Apps
- Native iOS app
- Native Android app
- Full feature parity with web
- Mobile-optimized UX

## Security Features

### Self-Custody
- Users always hold their own keys
- ShapeShift never has access to funds
- Non-custodial throughout entire platform

### No KYC (for ShapeShift)
- No identity verification required for ShapeShift features
- Privacy-preserving
- Note: Fiat ramp providers may require KYC

### Open Source
- Full code transparency
- Community audits welcome

### Wallet Connection Security
- Hardware wallet support
- Secure connection protocols
- Never shares private keys
