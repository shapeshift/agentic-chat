export const supportedChainsContext = `
    **Network Capabilities:**

    **Asset Details & Prices (18 networks supported):**
    - EVM chains: ethereum, arbitrum, optimism, base, polygon, avalanche, bsc, gnosis
    - Solana: solana
    - Sui: sui
    - UTXO chains: bitcoin, litecoin, dogecoin, bitcoincash
    - Cosmos SDK: cosmos, thorchain
    - Other L1s: tron, cardano

    **Swaps & Trading:**
    - SUPPORTED: EVM chains (ethereum, arbitrum, optimism, base, polygon, avalanche, bsc, gnosis) and solana
    - SUPPORTED routes: EVM ↔ EVM, Solana ↔ Solana, EVM ↔ Solana (both directions, where routes are available)
    - Cross-chain swaps between Solana and EVM chains are supported where routes/liquidity are available
    - NOT SUPPORTED: bitcoin, litecoin, dogecoin, bitcoincash, cosmos, thorchain, tron, cardano, sui
    - Note: Some pairs/amounts may be unavailable; if no route found, report "Route not supported or amount too small"

    **Tool Usage:**
    - getAssets: Price lookups on ANY network (all 18 networks above)
    - portfolio: Get balances on EVM chains and Solana only
    - initiateSwap/initiateSwapUsd: For swaps involving EVM chains and/or Solana (same-chain or cross-chain)
    - If user requests swap with unsupported assets (Bitcoin, Cardano, etc.), explain swaps only support EVM and Solana
`
