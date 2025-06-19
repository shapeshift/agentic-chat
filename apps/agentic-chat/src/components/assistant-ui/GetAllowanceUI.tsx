import {
  makeAssistantToolUI,
  ToolCallContentPartProps,
} from '@assistant-ui/react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { TextShimmer } from '../TextShimmer';
import { CollapsableDetails } from './CollapsableDetails';
import {
  GetAllowanceParams,
  GetAllowanceResult,
} from '../../tools/getAllowance';
import { useAssetsStore } from '../../stores/assets';

type GetAllowanceContentProps = Omit<
  ToolCallContentPartProps<GetAllowanceParams, GetAllowanceResult>,
  'args'
> & {
  args: Partial<GetAllowanceParams>;
};

const GetAllowanceContent: React.FC<GetAllowanceContentProps> = ({
  status,
  result,
  args,
  isError,
  toolName,
}) => {
  const assetsStore = useAssetsStore();
  const asset = assetsStore.assetsById[args.assetId ?? ''];
  switch (status.type) {
    case 'running':
    case 'requires-action':
    case 'incomplete': {
      if (!(args.assetId && args.spender)) {
        return <TextShimmer>Fetching allowance</TextShimmer>;
      }

      return (
        <TextShimmer>
          Fetching allowance for {asset?.symbol ?? ''}...
        </TextShimmer>
      );
    }
    case 'complete':
      if (isError) {
        return (
          <CollapsableDetails
            title={`An Error Occured with ${toolName}`}
            leftIcon={<AlertCircle className="w-4 h-4 text-red-500" />}
          >
            {result}
          </CollapsableDetails>
        );
      }
      return (
        <CollapsableDetails
          title="Token allowance"
          leftIcon={<CheckCircle className="w-4 h-4 text-primary" />}
        >
          <pre>{result}</pre>
        </CollapsableDetails>
      );
  }
};
const GetAllowanceUI = makeAssistantToolUI<
  GetAllowanceParams,
  GetAllowanceResult
>({
  toolName: 'getAllowance',
  render: GetAllowanceContent,
});

export default GetAllowanceUI;
