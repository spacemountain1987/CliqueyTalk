
import { NextRequest, NextResponse } from 'next/server';

/**
 * A generic proxy for making authenticated requests to the Discord API.
 * It takes a `ds-path` header for the Discord API path (e.g., /users/@me)
 * and forwards the request using the user's access token from the Authorization header.
 */
export async function GET(req: NextRequest) {
  return new NextResponse('Not Found', { status: 404 });
}


export async function POST(req: NextRequest) {
  return new NextResponse('Not Found', { status: 404 });
}
