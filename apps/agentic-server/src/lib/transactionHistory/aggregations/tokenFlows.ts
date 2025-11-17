import type { ParsedTransaction } from '@shapeshiftoss/types'

import type { Direction } from './fieldTypes'

export function tokenFlows(
  transactions: ParsedTransaction[],
  config: {
    direction?: Direction
  }
): Record<string, string> {
  const direction = config.direction || 'net'
  const flows: Record<string, { in: bigint; out: bigint }> = {}

  for (const tx of transactions) {
    if (!tx.tokenTransfers || tx.tokenTransfers.length === 0) {
      continue
    }

    for (const transfer of tx.tokenTransfers) {
      const assetId = transfer.assetId

      if (!flows[assetId]) {
        flows[assetId] = { in: 0n, out: 0n }
      }

      const amount = parseFloat(transfer.amount)
      if (transfer.decimals === undefined) continue
      const amountBigInt = BigInt(Math.floor(Math.abs(amount) * Math.pow(10, transfer.decimals)))

      if (amount > 0) {
        flows[assetId].in += amountBigInt
      } else if (amount < 0) {
        flows[assetId].out += amountBigInt
      }
    }
  }

  const result: Record<string, string> = {}

  for (const [assetId, { in: inFlow, out: outFlow }] of Object.entries(flows)) {
    switch (direction) {
      case 'in':
        result[assetId] = inFlow.toString()
        break
      case 'out':
        result[assetId] = outFlow.toString()
        break
      case 'net':
        result[assetId] = (inFlow - outFlow).toString()
        break
    }
  }

  return result
}
