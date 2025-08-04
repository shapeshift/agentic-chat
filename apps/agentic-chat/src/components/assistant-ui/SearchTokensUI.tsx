import type { ToolCallContentPartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { SearchTokensInput, SearchTokensOutput } from '@shapeshiftoss/agentic-server'
import type { Asset } from '@shapeshiftoss/types'
import { Search } from 'lucide-react'

import { TextShimmer } from '../TextShimmer'

import { CollapsableDetails } from './CollapsableDetails'

const Icon = Search

type SearchTokensContentProps = Omit<ToolCallContentPartProps<SearchTokensInput, SearchTokensOutput>, 'args'> & {
  args: Partial<SearchTokensInput>
}

export const SearchTokensContent: React.FC<SearchTokensContentProps> = ({ args, status, result, isError }) => {
  switch (status.type) {
    case 'running':
    case 'requires-action':
    case 'incomplete': {
      if (!args.searchTerm) {
        return <TextShimmer>Searching tokens...</TextShimmer>
      }

      return <TextShimmer>{`Searching tokens for ${args.searchTerm}...`}</TextShimmer>
    }
    case 'complete': {
      if (isError || !result) {
        return (
          <CollapsableDetails title="No tokens found" leftIcon={<Icon className="w-4 h-4 text-red-500" />}>
            {'No tokens found'}
          </CollapsableDetails>
        )
      }

      return (
        <CollapsableDetails
          title={`Found ${result.assets.length} tokens`}
          leftIcon={<Icon className="w-4 h-4 text-green-500" />}
        >
          <ul className="space-y-2">
            {result.assets.map((asset: Asset) => (
              <li key={asset.assetId} className="flex items-center gap-2">
                <span className="font-mono text-sm">{asset.symbol}</span>
                <span className="text-muted-foreground text-xs truncate">{asset.assetId}</span>
              </li>
            ))}
          </ul>
        </CollapsableDetails>
      )
    }
  }
}

const SearchTokensUI = makeAssistantToolUI<SearchTokensInput, SearchTokensOutput>({
  toolName: 'searchTokens',
  render: SearchTokensContent,
})

export default SearchTokensUI
