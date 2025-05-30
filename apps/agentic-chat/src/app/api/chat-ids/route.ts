import { getChatIds } from '../../../tools/chat-store';

export async function GET() {
  const posts = await getChatIds();

  return Response.json(posts);
}
