type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult =
  | {
      ok: true;
      limit: number;
      remaining: number;
      resetAt: number;
    }
  | {
      ok: false;
      limit: number;
      remaining: 0;
      resetAt: number;
      retryAfterSeconds: number;
    };

const buckets = new Map<string, RateLimitBucket>();

function pruneExpiredBuckets(now: number) {
  if (buckets.size < 1000) {
    return;
  }

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): RateLimitResult {
  const now = input.now ?? Date.now();

  pruneExpiredBuckets(now);

  const existingBucket = buckets.get(input.key);
  const bucket =
    existingBucket && existingBucket.resetAt > now
      ? existingBucket
      : {
          count: 0,
          resetAt: now + input.windowMs,
        };

  bucket.count += 1;
  buckets.set(input.key, bucket);

  if (bucket.count > input.limit) {
    return {
      ok: false,
      limit: input.limit,
      remaining: 0,
      resetAt: bucket.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  return {
    ok: true,
    limit: input.limit,
    remaining: Math.max(0, input.limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}
