export function getExplorerUrl(network: string, txid: string): string {
  const explorerMap: Record<string, string> = {
    ethereum: `https://etherscan.io/tx/${txid}`,
    polygon: `https://polygonscan.com/tx/${txid}`,
    arbitrum: `https://arbiscan.io/tx/${txid}`,
    base: `https://basescan.org/tx/${txid}`,
    avalanche: `https://snowtrace.io/tx/${txid}`,
    optimism: `https://optimistic.etherscan.io/tx/${txid}`,
    bsc: `https://bscscan.com/tx/${txid}`,
    gnosis: `https://gnosisscan.io/tx/${txid}`,
    solana: `https://solscan.io/tx/${txid}`,
  }

  return explorerMap[network] || `https://etherscan.io/tx/${txid}`
}
