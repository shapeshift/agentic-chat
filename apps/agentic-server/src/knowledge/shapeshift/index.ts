export const shapeshiftKnowledge = {
  company: `# ShapeShift Company & DAO

## History

### Origins (2014-2020)
- **Founded:** July 1, 2014 in Switzerland
- **Founder:** Erik Voorhees
- **Motivation:** Created in response to the Mt. Gox exchange collapse
- **Early Funding:**
  - March 2015: $525,000 seed funding from Roger Ver and Barry Silbert
  - March 2017: $10.4 million Series A funding
- **Original Model:** Centralized cryptocurrency exchange

### DAO Transformation (2021)
In 2021, ShapeShift underwent a historic transformation:
- **Largest crypto airdrop in history:** 340 million FOX tokens (34% of total supply) distributed to over 1 million users
- **Complete decentralization:** Dissolved entire corporate structure
- **Open-sourced:** Made entire platform codebase open-source
- **No bank accounts:** Eliminated all traditional banking relationships
- **Community governance:** Transitioned to DAO governance by FOX token holders

### Current Status (2025)
- Fully decentralized, community-owned DAO
- No corporate structure
- Governed by FOX token holders via ShapeShift DAO
- Treasury: 567 million FOX tokens (56.7% of total supply)
- Actively generating revenue through protocol fees

## Mission

ShapeShift's mission is to provide a powerful, community-owned, self-custody, multi-chain crypto platform for the world. The platform emphasizes:
- **Decentralization:** No centralized control or intermediaries
- **Self-custody:** Users maintain full control of their assets
- **Privacy:** No KYC requirements
- **Multi-chain:** Support for 19 blockchain networks
- **Open-source:** Transparent, auditable code
- **Community-owned:** Governed by the community, for the community

## DAO Benefits

The ShapeShift DAO offers unique benefits to contributors:
- Work from anywhere in the world
- Healthcare coverage (for US-based workers)
- Option to work anonymously
- Optional W2s for US contributors
- Payment in USDC, FOX, or fiat currency
- Fully distributed team of top talent

## Governance

- **Governance Platform:** Snapshot (snapshot.box/#/s:shapeshiftdao.eth)
- **Discussion Forum:** forum.shapeshift.com
- **Voting Rights:** FOX token holders
- **Proposals:** Community-submitted and voted on
- **Transparency:** All governance decisions are public and onchain`,

  platform: `# ShapeShift Platform Overview

## What is ShapeShift?

ShapeShift is a multichain crypto home base—a community-owned, private, non-custodial platform for trading, tracking, earning, and exploring crypto across 19 blockchain networks.

## Platform Statistics

- **Active Wallets:** 35,000+
- **Supported Chains:** 19 blockchain networks
- **Available Assets:** 10,000+ cryptocurrencies
- **Total Traded:** $1.7 billion

## Core Principles

### Non-Custodial
- Users maintain complete control of their private keys
- ShapeShift never holds or has access to user funds
- All trades and transactions are executed directly from user wallets
- Self-custody throughout the entire user experience

### No KYC Required
- No identity verification needed to use the platform
- No personal information collected for trading or swapping
- Privacy-preserving by design
- Note: Fiat on/off-ramp providers (Coinbase, Banxa, OnRamper, Mt Pelerin) may require KYC per regulatory requirements, but ShapeShift itself does not

### Open Source
- Entire platform codebase is publicly available
- Code can be audited by anyone
- Transparent development and community contributions welcomed

### Multi-Chain Support
ShapeShift supports 19 blockchain networks:
- Bitcoin, Bitcoin Cash, Litecoin, Dogecoin
- Ethereum, Arbitrum One, Arbitrum Nova, Optimism, Base, Polygon, Avalanche, BNB Smart Chain, Gnosis
- Cosmos Hub, THORChain, MAYAChain, Binance Chain
- Solana

### Mobile-First
- Native iOS and Android applications
- Full-featured mobile wallet
- Desktop web app also available
- Seamless experience across all devices

## Platform Access

### Supported Wallets
ShapeShift can be used with various wallet providers:
- MetaMask
- WalletConnect-compatible wallets
- Native ShapeShift mobile app (iOS/Android)
- Hardware wallets (Ledger, Trezor, KeepKey)
- And many more web3 wallets

### No Account Required
- Connect wallet directly to start using
- No signup or registration process
- Instant access to all platform features

## User Experience

### One-Click Simplicity
- Swap assets in one click
- Enter/exit DeFi positions seamlessly
- Automated best-price routing across all swap providers
- Minimal friction for complex operations

### Portfolio Tracking
- View balances across all 19 supported chains
- Track DeFi positions and yield-earning assets
- Monitor transaction history
- Fiat value conversion in multiple currencies

### Advanced Features
- Limit orders
- Custom slippage protection
- Multi-hop swap routing
- Cross-chain swaps without bridges
- Quote comparison across multiple providers`,

  swappers: `# ShapeShift Swap Providers

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

This means users can enter/exit complex DeFi positions in one click without ShapeShift directly integrating each protocol.`,

  chains: `# Supported Blockchain Networks

ShapeShift supports **19 blockchain networks** across multiple ecosystems, enabling true multi-chain functionality.

## Bitcoin-Based Chains (4)

### 1. Bitcoin
- First and largest cryptocurrency by market cap
- Native BTC support via THORChain, MAYAChain, Chainflip
- No wrapped tokens needed
- Full transaction history and balance tracking

### 2. Bitcoin Cash
- Bitcoin fork with larger block sizes
- Fast, low-cost transactions
- Native BCH support

### 3. Litecoin
- Silver to Bitcoin's gold
- Fast block times
- Native LTC support

### 4. Dogecoin
- Popular meme coin with strong community
- Low transaction fees
- Native DOGE support

## Ethereum & Layer 2 Chains (10)

### 1. Ethereum
- Largest smart contract platform
- Home to most DeFi protocols
- Full support for DeFi, NFTs, and dApps
- Swap providers: 0x, CoW Swap, THORChain, MAYAChain, Portals, Relay, and more

### 2. Arbitrum One
- Ethereum Layer 2
- Lower gas fees than mainnet
- **Home to rFOX staking**
- Swap providers: 0x, CoW Swap, Relay, Portals, Arbitrum Bridge

### 3. Arbitrum Nova
- Arbitrum's ultra-low-cost Layer 2
- Optimized for gaming and social applications

### 4. Optimism
- Ethereum Layer 2
- Low fees, fast transactions
- Growing DeFi ecosystem

### 5. Base
- Coinbase's Layer 2
- Low fees, high throughput
- Rapidly growing ecosystem

### 6. Polygon
- Ethereum scaling solution
- Very low fees
- Large DeFi and NFT ecosystem

### 7. Avalanche C-Chain
- High-performance smart contract platform
- Fast finality
- Growing DeFi ecosystem

### 8. BNB Smart Chain (BSC)
- Binance's smart contract platform
- Low fees, high throughput
- Large DeFi ecosystem

### 9. Gnosis Chain
- Community-owned network
- Extremely low fees
- Formerly xDai Chain

### 10. Binance Chain (Legacy)
- Original Binance chain
- BNB native chain

## Cosmos Ecosystem Chains (4)

### 1. Cosmos Hub
- Hub of the Cosmos ecosystem
- **Native ATOM staking supported**
- Validator selection and delegation

### 2. THORChain
- Decentralized cross-chain liquidity protocol
- Native RUNE token
- **Supports:**
  - THORChain Savers (single-sided liquidity)
  - THORChain Liquidity Pools
  - Cross-chain swaps

### 3. MAYAChain
- Independent cross-chain protocol
- Native CACAO token
- Cross-chain swap capabilities

### 4. Binance Chain (Beacon Chain)
- Original Binance blockchain
- Different from BNB Smart Chain

## Solana (1)

### Solana
- High-performance blockchain
- Very fast transactions
- Low fees
- **Swap provider:** Jupiter (Solana DEX aggregator)
- Growing DeFi and NFT ecosystem

## Cross-Chain Capabilities

ShapeShift's multi-chain support enables:
- **Native cross-chain swaps:** Swap BTC → ETH without wrapped tokens
- **Bridge aggregation:** Move assets between chains
- **Unified portfolio view:** See all balances across all 19 chains in one place
- **Multi-chain DeFi:** Access DeFi protocols across different ecosystems
- **Flexible wallet support:** Use different wallets for different chains`,

  staking: `# Staking & Yield Opportunities

ShapeShift provides access to **7 different staking and yield-earning opportunities**, allowing users to put their crypto to work.

## 1. rFOX Staking (Revenue Share)

### Overview
- **Chain:** Arbitrum One
- **Stake:** FOX tokens
- **Earn:** Share of ShapeShift DAO protocol revenue (distributed in USDC)
- **Latest Version:** rFOX 3.0 (launched 2025)

### How It Works
- Stake FOX tokens on Arbitrum
- Earn 25% of all DAO revenues distributed in USDC
- Effective yield: ~20.5% of protocol fees
- 5% monthly FOX token burn mechanism (deflationary)
- Revenue comes from swap fees and other platform activity

### Features
- Stake/unstake functionality
- Cooldown period for unstaking
- Claim rewards
- Bridge FOX from other chains to Arbitrum
- View staking history and APY
- Portfolio tracking integration

### Evolution
- **Original rFOX (2024):** Earned RUNE rewards from THORChain trading volume
- **rFOX 3.0 (2025):** Switched to USDC revenue share + FOX burn mechanism

## 2. TCY Staking (THORChain Yield)

### Overview
- **Chain:** THORChain
- **Stake:** RUNE
- **Earn:** TCY tokens + 10% of THORChain protocol revenue (in RUNE)
- **Type:** Debt-to-equity conversion solution for THORFi creditors

### How It Works
- Stake RUNE to receive TCY tokens
- TCY holders earn 10% share of THORChain protocol revenue
- Distributed in RUNE via gasless airdrops
- No lockups or cooldowns
- Unstake anytime

### Features
- Automatic TCY staking when claimed
- RUNE rewards appear in wallet at payout blocks
- Unstaked TCY does not earn rewards
- Complete UI for staking, unstaking, claiming

### Token Details
- Fixed supply: 210 million TCY tokens
- 1 TCY = $1 of defaulted THORFi debt
- Created to address THORFi lending defaults

## 3. FOXY Staking (FOX Yield on Ethereum)

### Overview
- **Chain:** Ethereum Mainnet
- **Stake:** FOX tokens
- **Earn:** FOXy token (staking rewards)
- **Type:** Single-sided staking

### How It Works
- Stake FOX on Ethereum to receive FOXy
- FOXy balance increases over time as rewards accumulate
- Redeemable 1:1 with FOX
- Rewards generated from DeFi yield opportunities

### Features
- Deposit/withdraw functionality
- Auto-compounding rewards
- No lockup period
- Integrates with ShapeShift DAO revenue streams

## 4. Cosmos SDK Native Staking

### Overview
- **Chain:** Cosmos Hub
- **Stake:** ATOM tokens
- **Earn:** Staking rewards from Cosmos network
- **Type:** Native validator delegation

### How It Works
- Delegate ATOM to validators
- Earn staking rewards (APY varies by validator)
- Support network security
- Participate in Cosmos governance

### Features
- Validator selection and comparison
- Deposit/withdraw/claim functionality
- View validator performance and commission
- Unbonding period (21 days for Cosmos)
- Redelegate to different validators

## 5. THORChain Savers

### Overview
- **Chain:** THORChain
- **Type:** Single-sided liquidity providing
- **Earn:** Yield from swap fees (no impermanent loss risk)

### How It Works
- Deposit single assets into THORChain Savers vaults
- Earn yield from swap fees
- No impermanent loss (single-sided)
- Different from traditional liquidity providing

### Supported Assets
- BTC (Bitcoin)
- ETH (Ethereum)
- USDC, USDT (Stablecoins)
- And other THORChain-supported assets

### Features
- Deposit/withdraw functionality
- Yield tracking
- No dual-sided LP required
- Lower risk than traditional LP

## 6. THORChain Liquidity Pools

### Overview
- **Chain:** THORChain
- **Type:** Dual-sided liquidity providing
- **Earn:** Swap fees + block rewards

### How It Works
- Provide liquidity in asset pairs (e.g., BTC-RUNE, ETH-RUNE)
- Earn swap fees from traders
- Earn additional RUNE block rewards
- Subject to impermanent loss

### Features
- Add/remove liquidity
- Pool selection and management
- Track impermanent loss and earnings
- Complete UI in ShapeShift platform

### Popular Pools
- BTC-RUNE
- ETH-RUNE
- USDC-RUNE
- ATOM-RUNE
- And more

## 7. FOX Farming (FOX-ETH LP Staking)

### Overview
- **Chain:** Ethereum Mainnet
- **Type:** Liquidity pool staking
- **Earn:** FOX token rewards

### How It Works
- Provide liquidity to FOX-ETH pool
- Receive FOX-ETH liquidity tokens
- Stake liquidity tokens to earn rewards
- Earn FOX rewards

### Features
- Deposit liquidity tokens
- Withdraw liquidity tokens
- Claim FOX rewards
- View APY and total staked
- Subject to impermanent loss (dual-sided liquidity)

## Comparison Table

| Opportunity | Chain | Asset Staked | Rewards | Risk Level |
|------------|-------|--------------|---------|------------|
| rFOX Staking | Arbitrum | FOX | USDC (revenue share) | Low |
| TCY Staking | THORChain | RUNE | RUNE (10% protocol revenue) | Medium |
| FOXY Staking | Ethereum | FOX | FOXy rewards | Low |
| Cosmos Staking | Cosmos Hub | ATOM | ATOM staking rewards | Low |
| THORChain Savers | THORChain | Various | Swap fees | Low (no IL) |
| THORChain LPs | THORChain | Asset pairs | Swap fees + RUNE | Medium (IL risk) |
| FOX Farming | Ethereum | FOX-ETH LP | FOX rewards | Medium (IL risk) |

## Key Concepts

### Impermanent Loss (IL)
- Risk when providing dual-sided liquidity
- Occurs when asset prices diverge
- THORChain Savers: No IL (single-sided)
- THORChain LPs & FOX Farming: IL risk exists

### APY vs APR
- APY: Annual Percentage Yield (includes compounding)
- APR: Annual Percentage Rate (simple interest)
- Rates vary based on protocol activity and participation

### Cooldown/Unbonding Periods
- rFOX: Has cooldown period for unstaking
- Cosmos: 21-day unbonding period
- TCY: No lockup or cooldown
- Others: Varies by opportunity

All staking opportunities are fully integrated into ShapeShift's UI with deposit, withdraw, claim, and tracking functionality.`,

  'fox-token': `# FOX Token

FOX is the governance and utility token of the ShapeShift DAO.

## Token Overview

- **Name:** FOX Token
- **Symbol:** FOX
- **Total Supply:** ~1 billion FOX (with burn mechanism reducing supply)
- **Governance:** ShapeShift DAO

## Token Contracts

FOX is available on 6 blockchain networks:

### Ethereum (Mainnet)
- **Contract:** \`0xc770eefad204b5180df6a14ee197d99d808ee52d\`
- Original FOX token deployment
- Used for FOXY staking and FOX Farming

### Arbitrum One
- **Contract:** \`0xf929de51D91C77E42f5090069E0AD7A09e513c73\`
- Primary chain for rFOX staking
- Lower gas fees than Ethereum

### Base
- **Contract:** \`0x2dbe0d779c7A04F7a5de83326973effE23356930\`
- Coinbase's L2 network
- Growing FOX ecosystem

### Gnosis Chain
- **Contract:** \`0x21a42669643f45bc0e086b8fc2ed70c23d67509d\`
- Extremely low fees
- Community-owned network

### Optimism
- **Contract:** \`0xf1a0da3367bc7aa04f8d94ba57b862ff37ced174\`
- Ethereum L2 with low fees

### Polygon
- **Contract:** \`0x65a05db8322701724c197af82c9cae41195b0aa8\`
- High-speed, low-cost network

## FOX Token Utility

### 1. Governance
- Vote on ShapeShift DAO proposals
- Participate in protocol decision-making
- Influence treasury management
- Voting platform: Snapshot (snapshot.box/#/s:shapeshiftdao.eth)

### 2. Revenue Share
- Stake FOX in rFOX on Arbitrum
- Earn 25% of protocol revenues in USDC
- Benefit from DAO's financial success

### 3. Platform Benefits
- Zero commission fees on trades (with FOX holdings)
- Access to exclusive features
- Priority in new feature rollouts

### 4. Yield Opportunities
- **rFOX Staking:** Earn USDC revenue share on Arbitrum
- **FOXY Staking:** Earn FOX yield on Ethereum
- **FOX Farming:** Provide FOX-ETH liquidity, earn FOX rewards

## DAO Treasury

The ShapeShift DAO controls a significant treasury:
- **Holdings:** 567 million FOX tokens
- **Percentage:** 56.7% of total FOX supply
- **Purpose:** Fund DAO operations, development, grants, and ecosystem growth
- **Management:** Community-governed via proposals and voting

## Token Distribution (Historical)

### 2021 Airdrop (DAO Launch)
- **Largest crypto airdrop in history**
- 340 million FOX tokens (34% of supply)
- Distributed to 1+ million users
- Recipients: ShapeShift customers, DeFi users, protocol participants

## Tokenomics

### Deflationary Mechanism
- **rFOX 3.0:** Introduces 5% monthly FOX burn
- Burns reduce circulating supply over time
- Target: 1-2% annual supply reduction
- Benefits: Potential value appreciation for holders

### Revenue Generation
- Platform charges 0.55% swap fee
- 25% of revenue → rFOX stakers (USDC)
- Remainder → DAO treasury and operations
- DAO actively generates revenue, not just token speculation

## How to Acquire FOX

### Trading
- Available on centralized exchanges (CEXs)
- Swap for FOX on ShapeShift platform
- DEXs: Uniswap, SushiSwap, and others

### Earning
- rFOX staking rewards
- FOXY staking rewards
- FOX Farming rewards
- DAO contributor payments

### Bridging
- Bridge FOX between supported chains
- Use ShapeShift's multi-chain swap functionality
- Native bridge support in platform

## FOX Holder Benefits Summary

| Benefit | Description |
|---------|-------------|
| Governance Rights | Vote on DAO proposals and protocol changes |
| Revenue Share | Stake in rFOX to earn USDC from protocol fees |
| Zero Fees | No commission on trades (varies by implementation) |
| Staking Yield | Multiple staking opportunities (rFOX, FOXY, Farming) |
| Community Access | Join DAO workstreams, Discord, forums |
| Deflationary Supply | 5% monthly burn reduces supply |

## Resources

- **Governance:** snapshot.box/#/s:shapeshiftdao.eth
- **Forum:** forum.shapeshift.com
- **Discord:** discord.gg/shapeshift
- **X (Twitter):** x.com/shapeshift

## Listing FOX

Exchanges and apps interested in listing FOX can contact:
- **Email:** listings@shapeshiftdao.org
- Provide liquidity, trading pairs, and community access to FOX`,

  features: `# ShapeShift Platform Features

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
- Never shares private keys`,

  'mobile-app': `# ShapeShift Mobile App

ShapeShift offers native mobile apps for iOS and Android, providing the full ShapeShift experience on mobile devices.

## Platform Availability

### iOS (iPhone & iPad)
- **Download:** App Store
- **Supports:** iPhone and iPad
- **Tablet Support:** Optimized for iPad

### Android
- **Download:** Google Play Store
- **Additional:** Available on Solana dApp Store

## Key Features

### Full Platform Functionality
The mobile app provides complete access to all ShapeShift features:
- Multi-chain portfolio tracking across 19 blockchains
- Swap and trade crypto
- Cross-chain swaps
- DeFi position tracking
- Staking opportunities (rFOX, TCY, FOXY, Cosmos, THORChain, FOX Farming)
- Limit orders
- Fiat on/off-ramps
- One-click DeFi entry/exit
- Transaction history

### Mobile-Optimized Experience
- Native app performance
- Mobile-optimized user interface
- Touch-friendly controls
- Optimized for smaller screens
- Fast and responsive

### WalletConnect Support
- Connect to external dApps using WalletConnect v2
- Use ShapeShift mobile as your wallet for any dApp
- Scan QR codes to connect to dApps
- Approve transactions on your phone
- Works with dApps on desktop and mobile

### QR Code Scanning
- Built-in QR code scanner
- Scan wallet addresses for sending crypto
- Scan WalletConnect QR codes to connect to dApps
- Fast and convenient address input

### Push Notifications
- Transaction status updates
- Limit order fill notifications
- Important account alerts
- Stay informed on the go

### Secure Mobile Wallet
- Non-custodial (you control your keys)
- No KYC required
- Secure storage
- Hardware wallet support
- Private and secure by default

## Mobile vs Web

### Same Features, Mobile Convenience
The mobile app provides the same features as the web app, with the added benefits of:
- Native mobile performance
- On-the-go access
- Push notifications
- QR code scanning
- WalletConnect integration
- Mobile-optimized UI

### Cross-Platform Sync
- Use the same wallet on mobile and web
- Seamless experience across devices
- Connect your preferred wallet provider
- Portfolio syncs automatically

## Getting Started

### Download & Install
1. Download from App Store (iOS) or Google Play Store (Android)
2. Open the app
3. Connect your wallet or create a new one
4. Start trading, tracking, and earning

### No Account Required
- No signup process
- No email or personal information needed
- Connect wallet and start using immediately
- Privacy-first design

## Mobile App Benefits

| Feature | Benefit |
|---------|---------|
| Native Performance | Fast, responsive mobile experience |
| Push Notifications | Stay updated on transactions and orders |
| QR Code Scanner | Easy address and dApp connection |
| WalletConnect | Use ShapeShift as wallet for any dApp |
| Full Feature Set | Complete platform access on mobile |
| Cross-Platform | Use same wallet on mobile and web |
| On-the-Go Access | Trade and track portfolio anywhere |

## Privacy & Security

- **Non-custodial:** You always control your private keys
- **No KYC:** No identity verification for ShapeShift features
- **Secure storage:** Keys stored securely on device
- **Open source:** Code is transparent and auditable
- **Privacy-focused:** Minimal data collection

## Download Links

- **iOS:** Available on the App Store
- **Android:** Available on Google Play Store
- **Solana dApp Store:** Available for Android users on Solana dApp Store

## Support

For mobile app support, users can reach out through:
- Discord community
- Forum at forum.shapeshift.com
- In-app support options`,
} as const

export type KnowledgeCategory = keyof typeof shapeshiftKnowledge
