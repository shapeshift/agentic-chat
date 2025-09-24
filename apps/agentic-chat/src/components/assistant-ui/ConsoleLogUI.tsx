import { makeAssistantToolUI } from '@assistant-ui/react'
import type { consoleLogInput, consoleLogOutput } from '@shapeshiftoss/agentic-server'
import { Terminal } from 'lucide-react'
import type { z } from 'zod'

import { TextShimmer } from '@/components/TextShimmer'

type ConsoleLogInput = z.infer<typeof consoleLogInput>
type ConsoleLogOutput = z.infer<typeof consoleLogOutput>

const ConsoleLogUI = makeAssistantToolUI<ConsoleLogInput, ConsoleLogOutput>({
  toolName: 'consoleLogTool',
  render: ({ status, result, args }) => {
    if (status.type === 'complete') {
      return (
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-green-500" />
          <p className="text-muted-foreground">📝 Logged to console: "{result?.message}"</p>
        </div>
      )
    }
    return <TextShimmer>Logging to console: {args.message}...</TextShimmer>
  },
})

export default ConsoleLogUI
