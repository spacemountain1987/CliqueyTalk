import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });

  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  };

  res.cookies.set('discord_access_token', '', cookieOptions);
  res.cookies.set('twitch_access_token', '', cookieOptions);
  res.cookies.set('discord_oauth_state', '', cookieOptions);
  res.cookies.set('twitch_oauth_state', '', cookieOptions);

  return res;
}
