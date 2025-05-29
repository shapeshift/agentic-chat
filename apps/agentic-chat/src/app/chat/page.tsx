import { redirect } from 'next/navigation';
import { createChat, getLatestChatId } from '../../tools/chat-store';

export default async function Page() {
  const latestChatId = await getLatestChatId();

  if (latestChatId) {
    redirect(`/chat/${latestChatId}`);
  }

  const id = await createChat(); // create a new chat
  redirect(`/chat/${id}`); // redirect to chat page
}
