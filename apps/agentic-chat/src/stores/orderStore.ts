import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface OrderRecord {
  orderHash: string
  safeAddress: string
  chainId: number
  sellToken: { address: string; symbol: string; amount: string; precision: number }
  buyToken: { address: string; symbol: string; amount: string; precision: number }
  sellAmountBaseUnit: string
  strikePrice: string
  validTo: number
  submitTxHash: string
  createdAt: number
  status: 'open' | 'triggered' | 'fulfilled' | 'cancelled' | 'expired' | 'failed' | 'partiallyFilled'
  conditionalOrderParams: { handler: string; salt: string; staticInput: string }
  orderType: 'stopLoss' | 'twap'
  network: string
  numParts?: number
}

export interface ActiveOrderSummary {
  orderHash: string
  chainId: number
  sellTokenAddress: string
  sellTokenSymbol: string
  sellAmountBaseUnit: string
  sellAmountHuman: string
  buyTokenAddress: string
  buyTokenSymbol: string
  buyAmountHuman: string
  strikePrice: string
  validTo: number
  submitTxHash: string
  createdAt: number
  network: string
  status: OrderRecord['status']
  orderType: OrderRecord['orderType']
  numParts?: number
}

function toActiveOrderSummary(record: OrderRecord): ActiveOrderSummary {
  return {
    orderHash: record.orderHash,
    chainId: record.chainId,
    sellTokenAddress: record.sellToken.address,
    sellTokenSymbol: record.sellToken.symbol,
    sellAmountBaseUnit: record.sellAmountBaseUnit,
    sellAmountHuman: record.sellToken.amount,
    buyTokenAddress: record.buyToken.address,
    buyTokenSymbol: record.buyToken.symbol,
    buyAmountHuman: record.buyToken.amount,
    strikePrice: record.strikePrice,
    validTo: record.validTo,
    submitTxHash: record.submitTxHash,
    createdAt: record.createdAt,
    network: record.network,
    status: record.status,
    orderType: record.orderType,
    numParts: record.numParts,
  }
}

interface OrderStore {
  orders: Record<string, OrderRecord[]>
  saveOrder: (order: OrderRecord) => void
  getOrders: (safeAddress: string, chainId?: number) => OrderRecord[]
  getActiveOrders: (safeAddress: string, chainId?: number) => OrderRecord[]
  updateStatus: (orderHash: string, safeAddress: string, status: OrderRecord['status']) => void
  removeOrder: (orderHash: string, safeAddress: string) => void
  getActiveOrderSummaries: (safeAddresses: string[]) => ActiveOrderSummary[]
  getAllOrderSummaries: (safeAddresses: string[]) => ActiveOrderSummary[]
}

export const useOrderStore = create<OrderStore>()(
  persist(
    (set, get) => ({
      orders: {},

      saveOrder: (order: OrderRecord) =>
        set(state => {
          const key = order.safeAddress.toLowerCase()
          const existing = state.orders[key] ?? []
          const idx = existing.findIndex(o => o.orderHash === order.orderHash)
          const updated = idx >= 0 ? existing.map((o, i) => (i === idx ? order : o)) : [...existing, order]
          return { orders: { ...state.orders, [key]: updated } }
        }),

      getOrders: (safeAddress: string, chainId?: number) => {
        const orders = get().orders[safeAddress.toLowerCase()] ?? []
        if (chainId !== undefined) return orders.filter(o => o.chainId === chainId)
        return orders
      },

      getActiveOrders: (safeAddress: string, chainId?: number) => {
        return get()
          .getOrders(safeAddress, chainId)
          .filter(o => o.status === 'open')
      },

      updateStatus: (orderHash: string, safeAddress: string, status: OrderRecord['status']) =>
        set(state => {
          const key = safeAddress.toLowerCase()
          const existing = state.orders[key]
          if (!existing) return state
          const updated = existing.map(o => (o.orderHash === orderHash ? { ...o, status } : o))
          return { orders: { ...state.orders, [key]: updated } }
        }),

      removeOrder: (orderHash: string, safeAddress: string) =>
        set(state => {
          const key = safeAddress.toLowerCase()
          const existing = state.orders[key]
          if (!existing) return state
          return { orders: { ...state.orders, [key]: existing.filter(o => o.orderHash !== orderHash) } }
        }),

      getActiveOrderSummaries: (safeAddresses: string[]) => {
        const state = get()
        const unique = [...new Set(safeAddresses.map(a => a.toLowerCase()))]
        return unique.flatMap(addr => {
          const orders = state.orders[addr] ?? []
          return orders.filter(o => o.status === 'open').map(toActiveOrderSummary)
        })
      },

      getAllOrderSummaries: (safeAddresses: string[]) => {
        const state = get()
        const unique = [...new Set(safeAddresses.map(a => a.toLowerCase()))]
        return unique.flatMap(addr => (state.orders[addr] ?? []).map(toActiveOrderSummary))
      },
    }),
    {
      name: 'order-registry',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      migrate: persisted => persisted as OrderStore,
    }
  )
)
