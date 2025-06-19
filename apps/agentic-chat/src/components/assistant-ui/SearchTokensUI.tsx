import {
  makeAssistantToolUI,
  ToolCallContentPartProps,
} from '@assistant-ui/react';
import { Search } from 'lucide-react';
import { TextShimmer } from '../TextShimmer';
import { CollapsableDetails } from './CollapsableDetails';
import { Asset } from '@agentic-chat/types';
import {
  SearchTokensParams,
  SearchTokensResult,
} from '../../tools/searchTokens';

const Icon = Search;

type SearchTokensContentProps = Omit<
  ToolCallContentPartProps<SearchTokensParams, SearchTokensResult>,
  'args'
> & {
  args: Partial<SearchTokensParams>;
};

export const SearchTokensContent: React.FC<SearchTokensContentProps> = ({
  args,
  status,
  result,
  isError,
}) => {
  switch (status.type) {
    case 'complete':
      if (isError || !result) {
        return (
          <CollapsableDetails
            title="No tokens found"
            leftIcon={<Icon className="w-4 h-4 text-red-500" />}
          >
            {result ? result.total : 'No tokens found'}
          </CollapsableDetails>
        );
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
                <span className="text-muted-foreground text-xs truncate">
                  {asset.assetId}
                </span>
              </li>
            ))}
          </ul>
        </CollapsableDetails>
      );
    default:
      return (
        <TextShimmer>Searching tokens for "{args.searchTerm}"...</TextShimmer>
      );
  }
};

const SearchTokensUI = makeAssistantToolUI<
  SearchTokensParams,
  SearchTokensResult
>({
  toolName: 'searchTokens',
  render: SearchTokensContent,
});

export default SearchTokensUI;
