
import { NextRequest, NextResponse } from 'next/server';

// This file is legacy and should not be used.
// All interaction logic is handled in /app/api/discord/interactions/route.ts
export async function POST(req: NextRequest) {
    return new NextResponse('Unhandled interaction type. This endpoint is deprecated.', { status: 400 });
}
