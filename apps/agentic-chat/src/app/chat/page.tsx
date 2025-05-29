import { redirect } from 'next/navigation';
import { createChat } from '../../tools/chat-store';

export default async function Page() {
  const id = await createChat(); // create a new chat
  redirect(`/chat/${id}`); // redirect to chat page
}
