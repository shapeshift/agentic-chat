import {
  makeAssistantToolUI,
  ToolCallContentPartProps,
} from '@assistant-ui/react';
import { BadgeCheck } from 'lucide-react';
import { TextShimmer } from '../TextShimmer';
import { CollapsableDetails } from './CollapsableDetails';
import { useAssetsStore } from '../../stores/assets';
import { ApproveParams, ApproveResult } from '../../tools/approve';

const Icon = BadgeCheck;

type ApproveUiContentProps = Omit<
  ToolCallContentPartProps<ApproveParams, ApproveResult>,
  'args'
> & {
  args: Partial<ApproveParams>;
};

const ApproveUiContent: React.FC<ApproveUiContentProps> = ({
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
      if (!(args.amountCryptoPrecision && asset))
        return <TextShimmer>Approving token</TextShimmer>;

      return (
        <TextShimmer>
          Approving {args.amountCryptoPrecision} of {asset.symbol}...
        </TextShimmer>
      );
    }
    case 'complete':
      if (isError) {
        return (
          <CollapsableDetails
            title={`An Error Occured with ${toolName}`}
            leftIcon={<Icon className="w-4 h-4 text-red-500" />}
          >
            {result}
          </CollapsableDetails>
        );
      }
      return (
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-green-500" />
          <p className="text-muted-foreground">
            Approval transaction sent: {result}
          </p>
        </div>
      );
  }
};
const ApproveUI = makeAssistantToolUI<ApproveParams, ApproveResult>({
  toolName: 'approve',
  render: ApproveUiContent,
});

export default ApproveUI;
