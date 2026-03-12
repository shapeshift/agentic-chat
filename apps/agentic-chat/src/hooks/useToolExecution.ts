import { useDynamicContext, useSwitchWallet } from '@dynamic-labs/sdk-react-core'
import type { MutableRefObject } from 'react'
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'

import type { ToolExecutionState, ToolMetaMap } from '@/lib/executionState'
import { useChatStore } from '@/stores/chatStore'
import type { ToolName } from '@/types/toolOutput'

import { useWalletConnection } from './useWalletConnection'

export interface ExecutionContext<TMeta> {
  state: ToolExecutionState<TMeta>
  toolCallId: string
  setState: (updater: (draft: ToolExecutionState<TMeta>) => void) => void
  advanceStep: () => void
  skipStep: () => void
  setMeta: (partial: Partial<TMeta>) => void
  setSubstatus: (text?: string) => void
  markTerminal: () => void
  persist: () => void
  failAndPersist: (error: unknown) => string
  refs: {
    evmWallet: MutableRefObject<ReturnType<typeof useWalletConnection>['evmWallet']>
    solanaWallet: MutableRefObject<ReturnType<typeof useWalletConnection>['solanaWallet']>
    evmAddress: MutableRefObject<string | undefined>
    solanaAddress: MutableRefObject<string | undefined>
    conversationId: MutableRefObject<string | undefined>
    primaryWallet: MutableRefObject<ReturnType<typeof useDynamicContext>['primaryWallet']>
    changePrimaryWallet: MutableRefObject<ReturnType<typeof useSwitchWallet>>
  }
}

export function useToolExecution<K extends ToolName>(
  toolCallId: string,
  toolName: K,
  initialMeta: ToolMetaMap[K]
): ExecutionContext<ToolMetaMap[K]> {
  const { evmAddress, solanaAddress, solanaWallet, evmWallet } = useWalletConnection()
  const store = useChatStore()
  const { conversationId: activeConversationId } = useParams<{ conversationId?: string }>()
  const { primaryWallet } = useDynamicContext()
  const changePrimaryWallet = useSwitchWallet()

  const evmWalletRef = useRef(evmWallet)
  const solanaWalletRef = useRef(solanaWallet)
  const evmAddressRef = useRef(evmAddress)
  const solanaAddressRef = useRef(solanaAddress)
  const activeConversationIdRef = useRef(activeConversationId)
  const primaryWalletRef = useRef(primaryWallet)
  const changePrimaryWalletRef = useRef(changePrimaryWallet)
  evmWalletRef.current = evmWallet
  solanaWalletRef.current = solanaWallet
  evmAddressRef.current = evmAddress
  solanaAddressRef.current = solanaAddress
  activeConversationIdRef.current = activeConversationId
  primaryWalletRef.current = primaryWallet
  changePrimaryWalletRef.current = changePrimaryWallet

  const initialState: ToolExecutionState<ToolMetaMap[K]> = {
    toolCallId,
    toolName,
    conversationId: activeConversationId ?? '',
    timestamp: Date.now(),
    currentStep: 0,
    completedSteps: [],
    skippedSteps: [],
    terminal: false,
    meta: initialMeta,
  }

  const hasHydratedRef = useRef(false)
  const lastToolCallIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (lastToolCallIdRef.current !== toolCallId) {
      hasHydratedRef.current = false
      lastToolCallIdRef.current = toolCallId
    }

    if (!hasHydratedRef.current && !store.runtimeToolStates.has(toolCallId)) {
      const persisted = store.getPersistedTransaction(toolCallId)
      if (persisted) {
        store.initializeRuntimeState(toolCallId, persisted)
        hasHydratedRef.current = true
      }
    }
  }, [toolCallId, store])

  const state = useChatStore(s => {
    const toolState = s.runtimeToolStates.get(toolCallId)
    return toolState !== undefined ? (toolState as ToolExecutionState<ToolMetaMap[K]>) : initialState
  })

  const setState = (updater: (draft: ToolExecutionState<ToolMetaMap[K]>) => void) => {
    store.setRuntimeState(toolCallId, updater)
  }

  const advanceStep = () => {
    setState(draft => {
      if (!draft.completedSteps.includes(draft.currentStep)) {
        draft.completedSteps.push(draft.currentStep)
      }
      draft.currentStep += 1
      draft.error = undefined
      draft.substatus = undefined
    })
  }

  const skipStepFn = () => {
    setState(draft => {
      if (!draft.skippedSteps.includes(draft.currentStep)) {
        draft.skippedSteps.push(draft.currentStep)
      }
      draft.currentStep += 1
      draft.substatus = undefined
    })
  }

  const setMeta = (partial: Partial<ToolMetaMap[K]>) => {
    setState(draft => {
      Object.assign(draft.meta, partial)
    })
  }

  const setSubstatus = (text?: string) => {
    setState(draft => {
      draft.substatus = text
    })
  }

  const markTerminalFn = () => {
    setState(draft => {
      draft.terminal = true
    })
  }

  const failAndPersist = (error: unknown): string => {
    const errorMessage = error instanceof Error ? error.message : String(error)
    setState(draft => {
      draft.error = errorMessage
      draft.failedStep = draft.currentStep
      draft.terminal = true
      draft.substatus = undefined
    })
    persist()
    return errorMessage
  }

  const persist = () => {
    const currentState = store.getRuntimeState<ToolExecutionState<ToolMetaMap[K]>>(toolCallId, initialState)
    const walletAddress = evmAddressRef.current ?? solanaAddressRef.current
    store.persistTransaction({
      ...currentState,
      conversationId: activeConversationIdRef.current ?? currentState.conversationId,
      timestamp: Date.now(),
      ...(walletAddress && { walletAddress }),
    })
  }

  return {
    state,
    toolCallId,
    setState,
    advanceStep,
    skipStep: skipStepFn,
    setMeta,
    setSubstatus,
    markTerminal: markTerminalFn,
    persist,
    failAndPersist,
    refs: {
      evmWallet: evmWalletRef,
      solanaWallet: solanaWalletRef,
      evmAddress: evmAddressRef,
      solanaAddress: solanaAddressRef,
      conversationId: activeConversationIdRef,
      primaryWallet: primaryWalletRef,
      changePrimaryWallet: changePrimaryWalletRef,
    },
  }
}
