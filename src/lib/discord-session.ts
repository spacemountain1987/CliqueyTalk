import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

export type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  discriminator?: string;
  email?: string | null;
};

const DISCORD_API_BASE = 'https://discord.com/api/v10';

function normalizeBearerToken(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.toLowerCase().startsWith('bearer ')) return trimmed.slice('bearer '.length).trim();
  return trimmed;
}

export function getDiscordAccessTokenFromCookieStore(): string | null {
  const token = cookies().get('discord_access_token')?.value;
  return token ? normalizeBearerToken(token) : null;
}

export function getDiscordAccessTokenFromRequest(req: NextRequest): string | null {
  const token = req.cookies.get('discord_access_token')?.value;
  return token ? normalizeBearerToken(token) : null;
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${DISCORD_API_BASE}/users/@me`, {
    headers: {
      Authorization: `Bearer ${normalizeBearerToken(accessToken)}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Discord session invalid (status ${res.status}). ${body}`);
  }

  return res.json();
}

export async function requireDiscordSession(req: NextRequest): Promise<{ accessToken: string; user: DiscordUser }> {
  const token = getDiscordAccessTokenFromRequest(req);
  if (!token) throw new Error('Not authenticated with Discord.');
  const user = await fetchDiscordUser(token);
  return { accessToken: token, user };
}
