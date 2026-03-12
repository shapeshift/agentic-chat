import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { isSolanaWallet } from '@dynamic-labs/solana'
import type { SwitchNetworkOutput } from '@shapeshiftoss/agentic-server'
import { ArrowRightLeft } from 'lucide-react'

import { useExecuteOnce } from '@/hooks/useExecuteOnce'
import { useToolExecution } from '@/hooks/useToolExecution'
import { networkNameToChainId } from '@/lib/chains'
import { useChatStore } from '@/stores/chatStore'

import { CollapsableDetails } from '../ui/CollapsableDetails'
import { StatusText } from '../ui/StatusText'

import { useToolStateRender } from './toolUIHelpers'
import type { ToolUIComponentProps } from './toolUIHelpers'

const Icon = ArrowRightLeft

const ErrorDetails: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <CollapsableDetails title={title} leftIcon={<Icon className="w-4 h-4 text-red-500" />}>
    {message}
  </CollapsableDetails>
)

export function SwitchNetworkUI({ toolPart }: ToolUIComponentProps<'switchNetworkTool'>) {
  const { state, output, toolCallId, errorText } = toolPart
  const networkOutput = output
  const { isHistorical, getPersistedTransaction } = useChatStore()

  const networkData = state === 'output-available' && networkOutput ? networkOutput : null

  const ctx = useToolExecution(toolCallId, 'switchNetworkTool', {
    phase: 'idle',
  })

  useExecuteOnce(ctx, networkData, async (data: SwitchNetworkOutput, ctx) => {
    const { refs } = ctx

    const targetChainId = networkNameToChainId[data.network]

    if (!targetChainId) {
      ctx.setState(draft => {
        draft.error = `Network "${data.network}" not found`
        draft.meta.phase = 'error'
        draft.meta.network = data.network
      })
      ctx.markTerminal()
      ctx.persist()
      return
    }

    if (data.network === 'solana') {
      if (refs.solanaWallet.current && refs.primaryWallet.current && !isSolanaWallet(refs.primaryWallet.current)) {
        await refs.changePrimaryWallet.current(refs.solanaWallet.current.id)
      }

      ctx.setState(draft => {
        draft.meta.phase = 'success'
        draft.meta.network = data.network
      })
      ctx.advanceStep()
      ctx.markTerminal()
      ctx.persist()
      return
    }

    ctx.setState(draft => {
      draft.meta.phase = 'switching'
      draft.meta.network = data.network
      draft.error = undefined
    })

    try {
      if (refs.evmWallet.current && refs.primaryWallet.current && !isEthereumWallet(refs.primaryWallet.current)) {
        await refs.changePrimaryWallet.current(refs.evmWallet.current.id)
      }

      if (!refs.evmWallet.current) {
        throw new Error('EVM wallet not connected')
      }

      await refs.evmWallet.current.connector.switchNetwork({ networkChainId: targetChainId })
      ctx.setState(draft => {
        draft.meta.phase = 'success'
      })
      ctx.advanceStep()
      ctx.markTerminal()
      ctx.persist()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      ctx.setState(draft => {
        draft.meta.phase = 'error'
        draft.error = errorMessage
      })
      ctx.markTerminal()
      ctx.persist()
    }
  })

  const phase = ctx.state.meta.phase
  const error = ctx.state.error

  const stateRender = useToolStateRender(state, {
    loading: 'Preparing network switch...',
    error: null,
  })

  if (stateRender) return stateRender

  if (state === 'output-error') {
    const message = errorText || 'Unknown error'
    return <ErrorDetails title="Failed to prepare network switch" message={message} />
  }

  if (phase === 'error') {
    return <ErrorDetails title="Network switch failed" message={error || 'Unknown error'} />
  }

  if (isHistorical(toolCallId) && !getPersistedTransaction(toolCallId)) {
    return <StatusText>⏭️ Network switch skipped (no saved data)</StatusText>
  }

  if (phase === 'switching' || phase === 'idle') {
    return <StatusText.Loading>Switching to {networkOutput?.network ?? ''}...</StatusText.Loading>
  }

  return (
    <StatusText.WithIcon>
      <StatusText.Icon icon={Icon} className="text-green-500" />
      <StatusText.Text>Switched to {networkOutput?.network ?? ''}</StatusText.Text>
    </StatusText.WithIcon>
  )
}
