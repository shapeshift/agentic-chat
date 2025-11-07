import type { ParsedTransaction, TokenTransfer, Network } from '@shapeshiftoss/types'
import { ArrowRight } from 'lucide-react'

import { formatCryptoAmount } from '@/lib/number'
import { formatTokenAmount, getSwapTokens } from '@/lib/transactionUtils'

import { AssetIcon } from '../ui/AssetIcon'

type TransactionInfographicProps = {
  tx: ParsedTransaction
  network: Network
  networkIcon?: string
}

export function TransactionInfographic({ tx, network, networkIcon }: TransactionInfographicProps) {
  const swapTokens = getSwapTokens(tx)

  if (swapTokens) {
    return (
      <div className="bg-whiteAlpha-50 border border-border rounded-lg p-4 mb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col items-center gap-2 flex-1">
            <AssetIcon
              contract={swapTokens.tokenOut.contract}
              network={network}
              symbol={swapTokens.tokenOut.symbol}
              networkIcon={networkIcon}
            />
            <span className="text-xs font-medium text-center">{formatTokenAmount(swapTokens.tokenOut)}</span>
          </div>

          <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />

          <div className="flex flex-col items-center gap-2 flex-1">
            <AssetIcon
              contract={swapTokens.tokenIn.contract}
              network={network}
              symbol={swapTokens.tokenIn.symbol}
              networkIcon={networkIcon}
            />
            <span className="text-xs font-medium text-center">{formatTokenAmount(swapTokens.tokenIn)}</span>
          </div>
        </div>
      </div>
    )
  }

  const transfer: TokenTransfer | undefined = tx.tokenTransfers?.[0]
  const symbol = transfer?.symbol ?? '???'
  const amount = transfer?.amount ?? tx.value
  const decimals = transfer?.decimals ?? 18

  return (
    <div className="bg-whiteAlpha-50 border border-border rounded-lg p-4 mb-3">
      <div className="flex flex-col items-center gap-2">
        <AssetIcon contract={transfer?.contract} network={network} symbol={symbol} networkIcon={networkIcon} />
        <span className="text-xs font-medium">{formatCryptoAmount(amount, { symbol, decimals })}</span>
      </div>
    </div>
  )
}
