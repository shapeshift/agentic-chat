import { Check, Copy } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useCallback } from 'react'

import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'

import { Button } from '../ui/Button'
import { StatusText } from '../ui/StatusText'
import { ToolCard } from '../ui/ToolCard'

import { useToolStateRender } from './toolUIHelpers'
import type { ToolUIComponentProps } from './toolUIHelpers'

export function ReceiveUI({ toolPart }: ToolUIComponentProps<'receiveTool'>) {
  const { state, output, errorText } = toolPart
  const receiveOutput = output
  const { isCopied: copied, copyToClipboard } = useCopyToClipboard({ timeout: 2000 })

  const stateRender = useToolStateRender(state, {
    loading: 'Getting receive address...',
    error: null,
  })

  const handleCopy = useCallback(() => {
    const addr = receiveOutput?.address
    if (!addr) return
    copyToClipboard(addr)
  }, [receiveOutput?.address, copyToClipboard])

  if (stateRender) return stateRender

  if (state === 'output-error') {
    const message = typeof errorText === 'string' ? errorText : 'Failed to get receive address'
    return <StatusText.Error>{message}</StatusText.Error>
  }

  if (!receiveOutput) return null

  const { address, network, asset } = receiveOutput
  const networkDisplay = network.charAt(0).toUpperCase() + network.slice(1)

  return (
    <ToolCard.Root>
      <ToolCard.Content>
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="text-base font-medium text-center">
            Receive {asset.symbol} on {networkDisplay}
          </div>

          <div className="p-3 bg-white rounded-lg shadow-sm">
            <QRCodeSVG value={address} size={160} level="M" includeMargin={false} />
          </div>

          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 bg-whiteAlpha-100 border border-whiteAlpha-200 rounded-lg px-3 py-2.5 font-mono text-xs break-all">
              {address}
            </div>
            <Button variant="outline" size="icon" onClick={handleCopy} className="flex-shrink-0 h-10 w-10">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>

          <div className="text-xs text-amber-500/90 text-center">
            Only send {networkDisplay}-compatible tokens to this address
          </div>
        </div>
      </ToolCard.Content>
    </ToolCard.Root>
  )
}
