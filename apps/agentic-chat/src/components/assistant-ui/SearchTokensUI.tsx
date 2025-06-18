import { makeAssistantToolUI } from '@assistant-ui/react';
import { AlertCircle, SearchIcon } from 'lucide-react';
import { TextShimmer } from '../TextShimmer';
import { CollapsableDetails } from './CollapsableDetails';
import { TokenSearchResult, PortalsToken } from '@agentic-chat/types';

export type SearchTokensArgs = {
  searchTerm: string;
  network?: string;
};

export type SearchTokensResult = TokenSearchResult;

const SearchTokensUI = makeAssistantToolUI<SearchTokensArgs, SearchTokensResult>({
  toolName: 'searchTokens',
  render: ({ status, result, args, isError }) => {
    switch (status.type) {
      case 'running':
      case 'requires-action':
      case 'incomplete':
        return (
          <TextShimmer>
            Searching tokens for "{args.searchTerm}"...
          </TextShimmer>
        );
      case 'complete':
        if (isError || !result) {
          return (
            <div className='flex items-center gap-2'>
              <AlertCircle className='w-4 h-4 text-red-500' />
              <p className='text-muted-foreground'>No tokens found</p>
            </div>
          );
        }

        return (
          <CollapsableDetails
            title={`Found ${result.total} tokens`}
            leftIcon={<SearchIcon className='w-4 h-4 text-muted-foreground' />}
          >
            <ul className='space-y-2'>
              {result.tokens.map((token: PortalsToken) => (
                <li key={token.address} className='flex items-center gap-2'>
                  <span className='font-mono text-sm'>{token.symbol}</span>
                  <span className='text-muted-foreground text-xs truncate'>
                    {token.address}
                  </span>
                </li>
              ))}
            </ul>
          </CollapsableDetails>
        );
    }
  },
});

export default SearchTokensUI;
