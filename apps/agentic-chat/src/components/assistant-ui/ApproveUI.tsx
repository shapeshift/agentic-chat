import {
  makeAssistantToolUI,
  ToolCallContentPartComponent,
} from '@assistant-ui/react';
import { BadgeCheck } from 'lucide-react';
import { TextShimmer } from '../TextShimmer';
import { CollapsableDetails } from './CollapsableDetails';
import { useAssetsStore } from '../../stores/assets';
import { ApproveParams, ApproveResult } from '../../tools/approve';

const Icon = BadgeCheck;

const ApproveUiContent: ToolCallContentPartComponent<
  {
    assetId: string;
    spender: string;
    amountCryptoPrecision: string;
  },
  string
> = ({ status, result, args, isError, toolName }) => {
  const assetsStore = useAssetsStore();
  const asset = assetsStore.assetsById[args.assetId];

  switch (status.type) {
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
    default:
      return (
        <TextShimmer>
          Approving {args.amountCryptoPrecision} of {asset.symbol}...
        </TextShimmer>
      );
  }
};
const ApproveUI = makeAssistantToolUI<ApproveParams, ApproveResult>({
  toolName: 'approve',
  render: ApproveUiContent,
});

export default ApproveUI;
