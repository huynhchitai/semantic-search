import { Ratelimit } from '@upstash/ratelimit';
import { getRedis } from './redis';

let cached: Ratelimit | null = null;

export function getRateLimiter(): Ratelimit | null {
  if (cached) return cached;
  const redis = getRedis();
  if (!redis) return null;
  cached = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 d'),
    analytics: false,
    prefix: 'rl:search',
  });
  return cached;
}

export type RateResult =
  | { ok: true; remaining: number; limit: number }
  | { ok: false; remaining: 0; limit: number; resetMs: number };

export async function checkRate(identifier: string): Promise<RateResult> {
  const rl = getRateLimiter();
  if (!rl) return { ok: true, remaining: 999, limit: 999 };
  const r = await rl.limit(identifier);
  return r.success
    ? { ok: true, remaining: r.remaining, limit: r.limit }
    : { ok: false, remaining: 0, limit: r.limit, resetMs: r.reset };
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'anon';
}
