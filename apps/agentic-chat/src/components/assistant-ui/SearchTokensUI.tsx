import { makeAssistantToolUI } from '@assistant-ui/react';
import { AlertCircle, Search, SearchIcon } from 'lucide-react';
import { TextShimmer } from '../TextShimmer';
import { CollapsableDetails } from './CollapsableDetails';
import { TokenSearchResult, PortalsToken } from '@agentic-chat/types';

export type SearchTokensArgs = {
  searchTerm: string;
  network?: string;
};

export type SearchTokensResult = TokenSearchResult;

const Icon = Search

const SearchTokensUI = makeAssistantToolUI<SearchTokensArgs, SearchTokensResult>({
  toolName: 'searchTokens',
  render: ({ status, result, args, isError }) => {
    switch (status.type) {


      case 'complete':
        if (isError || !result) {
          return (
            <CollapsableDetails title='No tokens found' leftIcon={<Icon className='w-4 h-4 text-red-500' />}>
              {result ? result.total : 'No tokens found'}
            </CollapsableDetails>
          );
        }

        return (
          <CollapsableDetails
            title={`Found ${result.tokens.length} tokens`}
            leftIcon={<Icon className='w-4 h-4 text-green-500' />}
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
      default:
        return <TextShimmer>Searching tokens for "{args.searchTerm}"...</TextShimmer>;
    }
  },
});

export default SearchTokensUI;
