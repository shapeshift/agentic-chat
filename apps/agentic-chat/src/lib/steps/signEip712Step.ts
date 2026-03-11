import type { ExecutionContext } from '@/hooks/useToolExecution'
import { signTypedDataWithWallet } from '@/lib/stepUtils'

interface Eip712SigningData {
  domain: object
  types: object
  primaryType: string
  message: object
}

export async function signEip712Step<TMeta extends object>(
  ctx: ExecutionContext<TMeta>,
  signingData: Eip712SigningData
): Promise<string> {
  if (!ctx.refs.evmWallet.current) throw new Error('EVM wallet not connected')

  ctx.setSubstatus('Requesting signature...')
  const signature = await signTypedDataWithWallet(ctx.refs.evmWallet.current, signingData)
  ctx.advanceStep()
  return signature
}
