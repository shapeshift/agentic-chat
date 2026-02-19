const STORAGE_KEY_PREFIX = 'order_registry_'

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
  status: 'open' | 'triggered' | 'fulfilled' | 'cancelled' | 'expired'
  conditionalOrderParams: { handler: string; salt: string; staticInput: string }
  orderType: 'stopLoss' | 'twap'
  network: string
}

function getStorageKey(safeAddress: string): string {
  return `${STORAGE_KEY_PREFIX}${safeAddress.toLowerCase()}`
}

function loadOrders(safeAddress: string): OrderRecord[] {
  try {
    const raw = localStorage.getItem(getStorageKey(safeAddress))
    if (!raw) return []
    const orders = JSON.parse(raw) as OrderRecord[]
    // Migrate legacy 'watching' status to 'open'
    let dirty = false
    for (const order of orders) {
      if ((order.status as string) === 'watching') {
        order.status = 'open'
        dirty = true
      }
    }
    if (dirty) persistOrders(safeAddress, orders)
    return orders
  } catch {
    return []
  }
}

function persistOrders(safeAddress: string, orders: OrderRecord[]): void {
  localStorage.setItem(getStorageKey(safeAddress), JSON.stringify(orders))
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
  }
}

export const orderRegistry = {
  saveOrder(order: OrderRecord): void {
    const orders = loadOrders(order.safeAddress)
    const existingIndex = orders.findIndex(o => o.orderHash === order.orderHash)
    if (existingIndex >= 0) {
      orders[existingIndex] = order
    } else {
      orders.push(order)
    }
    persistOrders(order.safeAddress, orders)
  },

  getOrders(safeAddress: string, chainId?: number): OrderRecord[] {
    const orders = loadOrders(safeAddress)
    if (chainId !== undefined) return orders.filter(o => o.chainId === chainId)
    return orders
  },

  getActiveOrders(safeAddress: string, chainId?: number): OrderRecord[] {
    return this.getOrders(safeAddress, chainId).filter(o => o.status === 'open')
  },

  updateStatus(orderHash: string, safeAddress: string, status: OrderRecord['status']): void {
    const orders = loadOrders(safeAddress)
    const order = orders.find(o => o.orderHash === orderHash)
    if (order) {
      order.status = status
      persistOrders(safeAddress, orders)
    }
  },

  removeOrder(orderHash: string, safeAddress: string): void {
    const orders = loadOrders(safeAddress).filter(o => o.orderHash !== orderHash)
    persistOrders(safeAddress, orders)
  },

  getActiveOrderSummaries(safeAddresses: string[]): ActiveOrderSummary[] {
    const uniqueAddresses = [...new Set(safeAddresses.map(a => a.toLowerCase()))]
    return uniqueAddresses.flatMap(addr => {
      const activeOrders = loadOrders(addr).filter(o => o.status === 'open')
      return activeOrders.map(toActiveOrderSummary)
    })
  },

  getAllOrderSummaries(safeAddresses: string[]): ActiveOrderSummary[] {
    const uniqueAddresses = [...new Set(safeAddresses.map(a => a.toLowerCase()))]
    return uniqueAddresses.flatMap(addr => loadOrders(addr).map(toActiveOrderSummary))
  },
}
