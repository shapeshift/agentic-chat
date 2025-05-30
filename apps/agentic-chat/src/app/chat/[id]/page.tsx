import { loadChat } from '../../../tools/chat-store';
import { Dashboard } from '../../../components/dashboard';

const ChatDashboard = async (props: { params: Promise<{ id: string }> }) => {
  const { id } = await props.params;
  const messages = await loadChat(id);

  return <Dashboard chatId={id} initialMessages={messages ?? []} />;
};

export default ChatDashboard;
