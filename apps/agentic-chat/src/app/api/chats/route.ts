import { NextResponse } from 'next/server';
import { getChatIds } from '../../../tools/chat-store';

export async function GET() {
  const ids = await getChatIds();
  return NextResponse.json({ ids });
}
