import { isEthereumWallet } from '@dynamic-labs/ethereum'
import type { VaultWithdrawAllOutput } from '@shapeshiftoss/agentic-server'
import type { DynamicToolUIPart } from 'ai'
import { toast } from 'sonner'

import { useExecuteOnce } from '@/hooks/useExecuteOnce'
import { useToolExecution } from '@/hooks/useToolExecution'
import type { ChainResult, ToolExecutionState, VaultWithdrawAllMeta } from '@/lib/executionState'
import { getStepStatus, toolStateToStepStatus } from '@/lib/executionState'
import { executeSafeBatchTransaction } from '@/lib/safe'
import type { StepStatus } from '@/lib/stepUtils'

export const VAULT_WITHDRAW_ALL_STEPS = { PREPARE: 0, WITHDRAW_CHAINS: 1 } as const

interface VaultWithdrawAllStepInfo {
  step: number
  status: StepStatus
}

interface UseVaultWithdrawAllExecutionResult {
  state: ToolExecutionState<VaultWithdrawAllMeta>
  steps: VaultWithdrawAllStepInfo[]
  chainResults: ChainResult[]
  currentChainIndex: number
  totalChains: number
  error?: string
}

export const useVaultWithdrawAllExecution = (
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  withdrawData: VaultWithdrawAllOutput | null
): UseVaultWithdrawAllExecutionResult => {
  const ctx = useToolExecution<VaultWithdrawAllMeta>(toolCallId, 'vault_withdraw_all', { chainResults: [] })

  useExecuteOnce(ctx, withdrawData, async (data, ctx) => {
    try {
      if (!ctx.refs.evmAddress.current) {
        throw new Error('Wallet disconnected. Please reconnect and try again.')
      }
      if (!ctx.refs.evmWallet.current) {
        throw new Error('EVM wallet not connected')
      }

      // Step 0: Prepare complete
      ctx.setState(draft => {
        draft.toolOutput = data
      })
      ctx.advanceStep()

      if (ctx.refs.primaryWallet.current && !isEthereumWallet(ctx.refs.primaryWallet.current)) {
        await ctx.refs.changePrimaryWallet.current(ctx.refs.evmWallet.current.id)
      }

      // Step 1: Execute each chain's batch sequentially (network switch -> sign batch)
      const chainResults: ChainResult[] = []

      for (const [i, withdrawal] of data.withdrawals.entries()) {
        ctx.setMeta({ currentChainIndex: i })

        try {
          ctx.setSubstatus(`Switching to ${withdrawal.network}...`)
          await ctx.refs.evmWallet.current.connector.switchNetwork({
            networkChainId: withdrawal.chainId,
          })

          ctx.setSubstatus(`Proposing Safe transaction on ${withdrawal.network}...`)
          const walletClient = await ctx.refs.evmWallet.current.getWalletClient()
          const txHash = await executeSafeBatchTransaction(
            withdrawal.safeAddress,
            withdrawal.safeBatchTransaction,
            ctx.refs.evmAddress.current,
            withdrawal.chainId,
            walletClient
          )

          chainResults.push({
            network: withdrawal.network,
            chainId: withdrawal.chainId,
            txHash,
          })

          ctx.setMeta({ chainResults: [...chainResults] })
        } catch (chainError) {
          const errorMessage = chainError instanceof Error ? chainError.message : String(chainError)
          chainResults.push({
            network: withdrawal.network,
            chainId: withdrawal.chainId,
            error: errorMessage,
          })

          ctx.setMeta({ chainResults: [...chainResults] })
        }
      }

      const hasAnySuccess = chainResults.some(r => r.txHash)
      if (!hasAnySuccess) {
        throw new Error('All chain withdrawals failed. Please try again.')
      }

      ctx.setMeta({ chainResults, currentChainIndex: data.withdrawals.length })
      ctx.advanceStep()
      ctx.markTerminal()
      ctx.persist()

      toast.success('Vault withdraw all is complete')
    } catch (error) {
      ctx.failAndPersist(error)

      toast.error('Vault withdraw all failed')
    }
  })

  const prepareStepStatus = toolStateToStepStatus(toolState)

  return {
    state: ctx.state,
    steps: [
      { step: VAULT_WITHDRAW_ALL_STEPS.PREPARE, status: prepareStepStatus },
      {
        step: VAULT_WITHDRAW_ALL_STEPS.WITHDRAW_CHAINS,
        status: getStepStatus(VAULT_WITHDRAW_ALL_STEPS.WITHDRAW_CHAINS, ctx.state),
      },
    ],
    chainResults: ctx.state.meta.chainResults ?? [],
    currentChainIndex: ctx.state.meta.currentChainIndex ?? 0,
    totalChains: withdrawData?.withdrawals.length ?? 0,
    error: ctx.state.error,
  }
}
