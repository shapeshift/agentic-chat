'use server'
import { Message } from 'ai';
import { existsSync } from 'fs';
import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

/**
 * Simple chat store that saves chats to the file system.
 * This is obviously for dev purposes only, although using an actual db will just be a matter
 * of storing/retrieving from a diff place, the shape of the data or the API of utils should
 * not change.
**/

const CHATS_DIR = '.chats';

export async function createChat(_id?: string): Promise<string> {
  const id = _id ?? Date.now().toString()
  await writeFile(await getChatFile(id), '[]');
  return id;
}

async function getChatFile(id: string): Promise<string> {
  const chatDir = path.join(process.cwd(), CHATS_DIR);
  if (!existsSync(chatDir)) await mkdir(chatDir, { recursive: true });
  return path.join(chatDir, `${id}.json`);
}

export async function loadChat(id: string): Promise<Message[] | null > {
  if (!existsSync(await getChatFile(id))) return null

  return JSON.parse(await readFile(await getChatFile(id), 'utf8'));
}

export async function saveChat({
  id,
  messages,
}: {
  id: string;
  messages: Message[];
}): Promise<void> {
  const content = JSON.stringify(messages, null, 2);
  await writeFile(await getChatFile(id), content);
}

export async function getLatestChatId(): Promise<string | null> {
  const chatDir = path.join(process.cwd(), CHATS_DIR);
  if (!existsSync(chatDir)) return null;

  const files = await readdir(chatDir);
  if (!files.length) return null;

  // Gets the latest chat file based on the timestamp in the filename

  const latestChat = files.sort((a, b) => {
    const aTime = parseInt(a.split('.')[0], 10);
    const bTime = parseInt(b.split('.')[0], 10);
    return bTime - aTime; // Sort in descending order
  })

  return latestChat[0].split('.')[0]; // Return the ID part of the filename
}

export async function getChatIds(): Promise<string[]> {
  const chatDir = path.join(process.cwd(), CHATS_DIR);
  if (!existsSync(chatDir)) return [];

  const files = await readdir(chatDir);
  return files.map(file => file.split('.')[0]).reverse() // Return only the IDs, sorted by latest to oldest
}
