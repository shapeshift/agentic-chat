import { makeAssistantToolUI } from '@assistant-ui/react'
import type { consoleLogInput, consoleLogOutput } from '@shapeshiftoss/agentic-server'
import { Terminal } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { z } from 'zod'

import { TextShimmer } from '@/components/TextShimmer'

import { CollapsableDetails } from './CollapsableDetails'

type ConsoleLogInput = z.infer<typeof consoleLogInput>
type ConsoleLogOutput = z.infer<typeof consoleLogOutput>

const Icon = Terminal

const ConsoleLogUI = makeAssistantToolUI<ConsoleLogInput, ConsoleLogOutput>({
  toolName: 'consoleLogTool',
  render: ({ status, result, args, isError }) => {
    const executedRef = useRef<number | null>(null)

    useEffect(() => {
      if (
        status.type === 'complete' && 
        !isError && 
        result?.action === 'console_log' && 
        result.timestamp !== executedRef.current
      ) {
        console.log(result.message)
        console.log('🚀 ConsoleLogUI triggered at:', new Date(result.timestamp).toISOString())
        executedRef.current = result.timestamp
      }
    }, [status.type, result?.action, result?.message, result?.timestamp, isError])

    switch (status.type) {
      case 'complete':
        if (isError) {
          return (
            <CollapsableDetails title="Console Log Error" leftIcon={<Icon className="w-4 h-4 text-red-500" />}>
              Failed to trigger console log
            </CollapsableDetails>
          )
        }
        return (
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-green-500" />
            <p className="text-muted-foreground">📝 Logged to console: "{result?.message}"</p>
          </div>
        )
      default:
        return <TextShimmer>Triggering console log: {args.message}...</TextShimmer>
    }
  },
})

export default ConsoleLogUI