import { NextResponse } from 'next/server';
import { createChat } from '../../../tools/chat-store';

export async function CREATE() {
  const id = await createChat();
  return NextResponse.json({ id });
}
