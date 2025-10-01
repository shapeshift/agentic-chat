import { create } from 'zustand'

export enum SwapStep {
  NETWORK_SWITCH = 0,
  APPROVAL = 1,
  SWAP = 2,
  COMPLETE = 3,
}

interface SwapState {
  currentStep: SwapStep
  completedSteps: Set<SwapStep>
  approvalTxHash?: string
  swapTxHash?: string
  error?: string
}

const initialSwapState: SwapState = {
  currentStep: SwapStep.NETWORK_SWITCH,
  completedSteps: new Set(),
}

type NetworkSwitchPhase = 'idle' | 'switching' | 'success' | 'error'

interface NetworkSwitchState {
  phase: NetworkSwitchPhase
  error?: string
}

const initialNetworkState: NetworkSwitchState = {
  phase: 'idle',
}

interface ToolExecutionState {
  executedIds: Set<string>
  swapStates: Map<string, SwapState>
  networkStates: Map<string, NetworkSwitchState>

  markExecuted: (toolCallId: string) => void
  hasExecuted: (toolCallId: string) => boolean

  getSwapState: (toolCallId: string) => SwapState
  swapNextStep: (toolCallId: string) => void
  swapSkipStep: (toolCallId: string) => void
  swapSetApprovalHash: (toolCallId: string, txHash: string) => void
  swapSetSwapHash: (toolCallId: string, txHash: string) => void
  swapSetError: (toolCallId: string, error: string) => void

  getNetworkState: (toolCallId: string) => NetworkSwitchState
  networkStartSwitch: (toolCallId: string) => void
  networkSwitchSuccess: (toolCallId: string) => void
  networkSetError: (toolCallId: string, error: string) => void
}

export const useToolExecutionStore = create<ToolExecutionState>((set, get) => ({
  executedIds: new Set(),
  swapStates: new Map(),
  networkStates: new Map(),

  markExecuted: (toolCallId: string) => {
    set(state => ({
      executedIds: new Set(state.executedIds).add(toolCallId),
    }))
  },

  hasExecuted: (toolCallId: string) => {
    return get().executedIds.has(toolCallId)
  },

  getSwapState: (toolCallId: string) => {
    return get().swapStates.get(toolCallId) ?? initialSwapState
  },

  swapNextStep: (toolCallId: string) => {
    set(state => {
      const currentState = state.swapStates.get(toolCallId) ?? initialSwapState
      const newSwapStates = new Map(state.swapStates)
      newSwapStates.set(toolCallId, {
        ...currentState,
        completedSteps: new Set([...currentState.completedSteps, currentState.currentStep]),
        currentStep: (currentState.currentStep + 1) as SwapStep,
        error: undefined,
      })
      return { swapStates: newSwapStates }
    })
  },

  swapSkipStep: (toolCallId: string) => {
    set(state => {
      const currentState = state.swapStates.get(toolCallId) ?? initialSwapState
      const newSwapStates = new Map(state.swapStates)
      newSwapStates.set(toolCallId, {
        ...currentState,
        currentStep: (currentState.currentStep + 1) as SwapStep,
        error: undefined,
      })
      return { swapStates: newSwapStates }
    })
  },

  swapSetApprovalHash: (toolCallId: string, txHash: string) => {
    set(state => {
      const currentState = state.swapStates.get(toolCallId) ?? initialSwapState
      const newSwapStates = new Map(state.swapStates)
      newSwapStates.set(toolCallId, {
        ...currentState,
        approvalTxHash: txHash,
      })
      return { swapStates: newSwapStates }
    })
  },

  swapSetSwapHash: (toolCallId: string, txHash: string) => {
    set(state => {
      const currentState = state.swapStates.get(toolCallId) ?? initialSwapState
      const newSwapStates = new Map(state.swapStates)
      newSwapStates.set(toolCallId, {
        ...currentState,
        swapTxHash: txHash,
      })
      return { swapStates: newSwapStates }
    })
  },

  swapSetError: (toolCallId: string, error: string) => {
    set(state => {
      const currentState = state.swapStates.get(toolCallId) ?? initialSwapState
      const newSwapStates = new Map(state.swapStates)
      newSwapStates.set(toolCallId, {
        ...currentState,
        error,
      })
      return { swapStates: newSwapStates }
    })
  },

  getNetworkState: (toolCallId: string) => {
    return get().networkStates.get(toolCallId) ?? initialNetworkState
  },

  networkStartSwitch: (toolCallId: string) => {
    set(state => {
      const currentState = state.networkStates.get(toolCallId) ?? initialNetworkState
      const newNetworkStates = new Map(state.networkStates)
      newNetworkStates.set(toolCallId, {
        ...currentState,
        phase: 'switching',
        error: undefined,
      })
      return { networkStates: newNetworkStates }
    })
  },

  networkSwitchSuccess: (toolCallId: string) => {
    set(state => {
      const currentState = state.networkStates.get(toolCallId) ?? initialNetworkState
      const newNetworkStates = new Map(state.networkStates)
      newNetworkStates.set(toolCallId, {
        ...currentState,
        phase: 'success',
      })
      return { networkStates: newNetworkStates }
    })
  },

  networkSetError: (toolCallId: string, error: string) => {
    set(state => {
      const currentState = state.networkStates.get(toolCallId) ?? initialNetworkState
      const newNetworkStates = new Map(state.networkStates)
      newNetworkStates.set(toolCallId, {
        ...currentState,
        phase: 'error',
        error,
      })
      return { networkStates: newNetworkStates }
    })
  },
}))
