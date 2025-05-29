'use server'
import { Message } from 'ai';
import { existsSync, mkdirSync } from 'fs';
import { readdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

/**
 * Simple chat store that saves chats to the file system.
 * This is obviously for dev purposes only, although using an actual db will just be a matter
 * of storing/retrieving from a diff place, the shape of the data or the API of utils should
 * not change.
**/

const CHATS_DIR = '.chats';

export async function createChat(): Promise<string> {
  const id = Date.now().toString()
  await writeFile(getChatFile(id), '[]');
  return id;
}

function getChatFile(id: string): string {
  const chatDir = path.join(process.cwd(), CHATS_DIR);
  if (!existsSync(chatDir)) mkdirSync(chatDir, { recursive: true });
  return path.join(chatDir, `${id}.json`);
}

export async function loadChat(id: string): Promise<Message[]> {
  return JSON.parse(await readFile(getChatFile(id), 'utf8'));
}

export async function saveChat({
  id,
  messages,
}: {
  id: string;
  messages: Message[];
}): Promise<void> {
  const content = JSON.stringify(messages, null, 2);
  await writeFile(getChatFile(id), content);
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
  return files.map(file => file.split('.')[0]); // Return only the IDs
}
