import { NextRequest } from 'next/server';

type Bucket = {
  tokens: number;
  updatedAtMs: number;
};

const buckets = new Map<string, Bucket>();

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xrip = req.headers.get('x-real-ip');
  if (xrip) return xrip.trim();
  return 'unknown';
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Simple in-memory token bucket limiter.
 * Note: best-effort only (per-instance). Still valuable to reduce accidental abuse.
 */
export function rateLimit(req: NextRequest, opts: { key: string; capacity: number; refillPerSecond: number }): RateLimitResult {
  const ip = getClientIp(req);
  const now = Date.now();
  const bucketKey = `${opts.key}:${ip}`;

  const existing = buckets.get(bucketKey);
  if (!existing) {
    buckets.set(bucketKey, { tokens: opts.capacity - 1, updatedAtMs: now });
    return { allowed: true };
  }

  const elapsedSeconds = Math.max(0, (now - existing.updatedAtMs) / 1000);
  const refill = elapsedSeconds * opts.refillPerSecond;
  const tokens = Math.min(opts.capacity, existing.tokens + refill);

  if (tokens < 1) {
    const retryAfterSeconds = Math.ceil((1 - tokens) / opts.refillPerSecond);
    existing.tokens = tokens;
    existing.updatedAtMs = now;
    return { allowed: false, retryAfterSeconds };
  }

  existing.tokens = tokens - 1;
  existing.updatedAtMs = now;
  return { allowed: true };
}
