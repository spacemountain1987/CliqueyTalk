import { NextRequest } from 'next/server';
import { auth as adminAuth } from '@/firebase/admin';

function parseBearerToken(header: string | null): string | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (!lower.startsWith('bearer ')) return null;
  return trimmed.slice('bearer '.length).trim();
}

export async function requireFirebaseIdToken(req: NextRequest): Promise<{ uid: string; isAdmin: boolean } & Record<string, any>> {
  const token = parseBearerToken(req.headers.get('authorization'));
  if (!token) {
    throw new Error('Missing Authorization bearer token.');
  }

  const decoded = await adminAuth.verifyIdToken(token);
  return {
    ...decoded,
    isAdmin: (decoded as any).isAdmin === true,
  };
}
