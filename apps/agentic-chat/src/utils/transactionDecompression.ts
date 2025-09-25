import { inflate } from 'pako'

function decompressTransactionData(compressedData: string): string {
  return inflate(Buffer.from(compressedData, 'base64'), { to: 'string' })
}

export function decompressSwapTransactionData<
  T extends {
    approvalTx?: { data: string } & Record<string, unknown>
    swapTx: { data: string } & Record<string, unknown>
  },
>(data: T): T {
  return {
    ...data,
    approvalTx: data.approvalTx
      ? {
          ...data.approvalTx,
          data: decompressTransactionData(data.approvalTx.data),
        }
      : undefined,
    swapTx: {
      ...data.swapTx,
      data: decompressTransactionData(data.swapTx.data),
    },
  }
}
