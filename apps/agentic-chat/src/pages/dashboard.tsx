import { Thread } from '../components/assistant-ui/thread';
import { ZustandProvider } from '../providers/ZustandProvider';

export default function DashboardPage() {
  return (
    <ZustandProvider>
      <div className="flex flex-col h-full">
        {/* Add your custom UI components here */}
        <Thread />
      </div>
    </ZustandProvider>
  );
}
