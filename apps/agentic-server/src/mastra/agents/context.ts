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
    - SUPPORTED routes: EVM ↔ EVM, Solana ↔ Solana, EVM ↔ Solana (cross-chain works in both directions)
    - Cross-chain swaps between Solana and any EVM chain are fully supported
    - NOT SUPPORTED: bitcoin, litecoin, dogecoin, bitcoincash, cosmos, thorchain, tron, cardano, sui

    **Tool Usage:**
    - getAssets: Price lookups on ANY network (all 18 networks above)
    - initiateSwap/initiateSwapUsd: For swaps involving EVM chains and/or Solana (same-chain or cross-chain)
    - If user requests swap with unsupported assets (Bitcoin, Cardano, etc.), explain swaps only support EVM and Solana
`
