import { Check, Copy } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useCallback } from 'react'

import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'

import { IconButton } from './IconButton'
import { Tooltip, TooltipContent, TooltipTrigger } from './Tooltip'

type CopyButtonProps = {
  value: string
  className?: string
}

export function CopyButton({ value, className }: CopyButtonProps) {
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 2000 })

  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation()
      copyToClipboard(value)
    },
    [copyToClipboard, value]
  )

  return (
    <Tooltip open={isCopied ? true : undefined}>
      <TooltipTrigger asChild>
        <IconButton
          icon={isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          label="Copy"
          size="sm"
          variant="ghost"
          onClick={handleClick}
          className={className}
        />
      </TooltipTrigger>
      <TooltipContent>{isCopied ? 'Copied' : 'Copy'}</TooltipContent>
    </Tooltip>
  )
}
