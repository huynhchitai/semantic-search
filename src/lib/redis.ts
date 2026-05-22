import { Redis } from '@upstash/redis';

let cached: Redis | null = null;
let warned = false;

/** Returns null when Upstash is not configured — callers must degrade gracefully. */
export function getRedis(): Redis | null {
  if (cached) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (!warned) {
      console.warn('[redis] UPSTASH_REDIS_REST_* not set — rate limiting and caches are no-ops.');
      warned = true;
    }
    return null;
  }
  cached = new Redis({ url, token });
  return cached;
}
