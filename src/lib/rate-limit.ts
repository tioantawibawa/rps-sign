import { env } from "@/lib/env";

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Fixed-window in-memory rate limiter. Adequate for a single-instance modular
 * monolith; swap for Redis when scaling horizontally (same interface).
 */
export function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  if (!env.RATE_LIMIT_ENABLED) {
    return { ok: true, remaining: limit, resetAt: Date.now() };
  }
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const existing = store.get(key);

  if (!existing || existing.resetAt < now) {
    const bucket = { count: 1, resetAt: now + windowMs };
    store.set(key, bucket);
    return { ok: true, remaining: limit - 1, resetAt: bucket.resetAt };
  }

  existing.count += 1;
  const ok = existing.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

/** Reset a key (e.g. after a successful login). */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

// Periodically evict expired buckets to bound memory.
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of store) {
      if (bucket.resetAt < now) store.delete(key);
    }
  }, 60_000);
  // Do not keep the event loop alive because of the limiter.
  if (typeof timer === "object" && "unref" in timer) timer.unref();
}
