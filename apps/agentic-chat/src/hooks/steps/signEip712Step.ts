import { signTypedDataWithWallet } from '@/lib/stepUtils'

import type { ExecutionContext } from '../useToolExecution'

interface Eip712SigningData {
  domain: object
  types: object
  primaryType: string
  message: object
}

export async function signEip712Step<TMeta extends Record<string, unknown>>(
  ctx: ExecutionContext<TMeta>,
  signingData: Eip712SigningData
): Promise<string> {
  if (!ctx.refs.evmWallet.current) throw new Error('EVM wallet not connected')

  const signature = await signTypedDataWithWallet(ctx.refs.evmWallet.current, signingData)
  ctx.advanceStep()
  return signature
}
