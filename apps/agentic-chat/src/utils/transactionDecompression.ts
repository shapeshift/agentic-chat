import { ungzip } from 'pako'

function decompressTransactionData(compressedData: string): string {
  const binary = atob(compressedData)
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  return ungzip(bytes, { to: 'string' })
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
