import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { requireDiscordSession } from '@/lib/discord-session';

export async function GET(req: NextRequest) {
  const rl = rateLimit(req, { key: 'discord-me', capacity: 30, refillPerSecond: 0.5 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const { user } = await requireDiscordSession(req);
    // Return only what the client needs.
    return NextResponse.json({
      id: user.id,
      username: user.username,
      global_name: user.global_name ?? null,
      avatar: user.avatar ?? null,
      discriminator: user.discriminator ?? null,
      email: user.email ?? null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unauthorized' }, { status: 401 });
  }
}
