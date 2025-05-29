import { NextResponse } from 'next/server';
import { createChat } from '../../../tools/chat-store';

// We will probably want to do this better in the future, but for the time being, pretty straightforward,
// allows us to call this from clients to create a new chat sesh
export async function POST() {
  const id = await createChat();
  return NextResponse.json({ id });
}
