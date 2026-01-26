import { NextRequest, NextResponse } from 'next/server';
import { auth as adminAuth, db } from '@/firebase/admin';
import { requireDiscordSession } from '@/lib/discord-session';
import { rateLimit } from '@/lib/rate-limit';
import { getLatestSecretCached } from '@/lib/secrets';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

async function fetchGuildOwnerId(botToken: string, guildId: string): Promise<string> {
  const res = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}`, {
    headers: { Authorization: `Bot ${botToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to fetch guild details (status ${res.status}). ${body}`);
  }
  const data = await res.json();
  return data.owner_id;
}

async function fetchMemberRoles(botToken: string, guildId: string, userId: string): Promise<string[]> {
  const res = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${botToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    // If the bot can't see the member, treat as non-admin.
    return [];
  }
  const data = await res.json();
  return Array.isArray(data.roles) ? data.roles : [];
}

export async function GET(req: NextRequest) {
  const rl = rateLimit(req, { key: 'firebase-token', capacity: 10, refillPerSecond: 0.2 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const { user: discordUser } = await requireDiscordSession(req);

    let guildId: string;
    let botToken: string;
    try {
      [guildId, botToken] = await Promise.all([
        getLatestSecretCached('DISCORD_GUILD_ID'),
        getLatestSecretCached('DISCORD_BOT_TOKEN'),
      ]);
    } catch {
      return NextResponse.json({ error: 'Server is not configured for Discord verification.' }, { status: 500 });
    }

    const [guildOwnerId, memberRoles, adminRolesDoc] = await Promise.all([
      fetchGuildOwnerId(botToken, guildId),
      fetchMemberRoles(botToken, guildId, discordUser.id),
      db.collection('app_settings').doc('admin_roles').get(),
    ]);

    const adminRoleIds = adminRolesDoc.exists ? (adminRolesDoc.data()?.roles ?? []) : [];
    const hasAdminRole = Array.isArray(adminRoleIds)
      ? memberRoles.some((roleId) => adminRoleIds.includes(roleId))
      : false;

    const isAdmin = discordUser.id === guildOwnerId || hasAdminRole;

    // Use Discord ID as the Firebase UID to simplify rules and ownership.
    const firebaseUid = discordUser.id;
    const customToken = await adminAuth.createCustomToken(firebaseUid, {
      discordId: discordUser.id,
      isAdmin,
    });

    return NextResponse.json({ token: customToken, discordId: discordUser.id, isAdmin });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unauthorized' }, { status: 401 });
  }
}
