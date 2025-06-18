import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Card, CardContent } from "../ui/card";

type CollapsableDetailsProps = {
  children: React.ReactNode;
  leftIcon?: React.ReactNode;
  title: string | React.ReactNode;
};

export const CollapsableDetails = ({ children, title, leftIcon }: CollapsableDetailsProps) => {
  return (
    <div className='flex flex-col gap-2 w-full'>
      <Collapsible>
        <CollapsibleTrigger className='flex items-center gap-2'>
          <div className='flex items-center gap-2'>
            {leftIcon && <div className='w-4 h-4 text-primary'>{leftIcon}</div>}
            <p className='text-muted-foreground'>{title}</p>
          </div>
          <ChevronDown className='w-4 h-4' />
        </CollapsibleTrigger>

        <CollapsibleContent><Card className='w-full my-2 overflow-auto max-h-[500px]'><CardContent>{children}</CardContent></Card></CollapsibleContent>
      </Collapsible>
    </div>
  );
};