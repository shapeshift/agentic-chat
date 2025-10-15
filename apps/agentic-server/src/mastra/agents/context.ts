export const supportedChainsContext = `
    **Network Capabilities:**

    **Asset Details & Prices (18 networks supported):**
    - EVM chains: ethereum, arbitrum, optimism, base, polygon, avalanche, bsc, gnosis
    - Solana: solana
    - Sui: sui
    - UTXO chains: bitcoin, litecoin, dogecoin, bitcoincash
    - Cosmos SDK: cosmos, thorchain
    - Other L1s: tron, cardano

    **Swaps & Trading (EVM + Solana ONLY):**
    - SUPPORTED for swaps: EVM chains (ethereum, arbitrum, optimism, base, polygon, avalanche, bsc, gnosis) and solana
    - NOT SUPPORTED for swaps: bitcoin, litecoin, dogecoin, bitcoincash, cosmos, thorchain, tron, cardano, sui

    **Important:**
    - Use getAssets tool for price lookups on ANY network
    - Use initiateSwap tool ONLY for EVM and Solana networks
    - If user requests swap on unsupported network, politely explain swaps are only available on EVM chains and Solana
`
