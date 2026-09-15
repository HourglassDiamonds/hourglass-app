export type AbuseRateLimitConsumeInput = {
  bucketKey: string;
  windowStartEpochMs: number;
  windowMs: number;
  limit: number;
  nowEpochMs: number;
};

export type AbuseRateLimitConsumeResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  hitCount: number;
};

export type AbuseRateLimitStore = {
  consume(
    input: AbuseRateLimitConsumeInput,
  ): Promise<AbuseRateLimitConsumeResult>;
  check?(
    input: AbuseRateLimitConsumeInput,
  ): Promise<AbuseRateLimitConsumeResult>;
  clearBucket?(bucketKey: string): Promise<void>;
  debugBucketKeys?: () => string[];
  debugLiveRowCount?: () => number;
  clear?: () => void;
};

class SerialQueue {
  private tail: Promise<void> = Promise.resolve();

  enqueue<T>(fn: () => T | Promise<T>): Promise<T> {
    const run = this.tail.then(fn, fn);
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

type MemoryBucket = {
  count: number;
  windowStartEpochMs: number;
  expiresAtMs: number;
};

const MEMORY_EXPIRE_SWEEP = 32;

export function createMemoryAbuseRateLimitStore(): AbuseRateLimitStore {
  const buckets = new Map<string, MemoryBucket>();
  const queue = new SerialQueue();

  return {
    consume(input) {
      return queue.enqueue(() => {
        const expiresAtMs = input.windowStartEpochMs + input.windowMs;
        const current = buckets.get(input.bucketKey);
        const sameWindow =
          current !== undefined &&
          current.windowStartEpochMs === input.windowStartEpochMs;
        const nextCount = sameWindow ? current.count + 1 : 1;
        buckets.set(input.bucketKey, {
          count: nextCount,
          windowStartEpochMs: input.windowStartEpochMs,
          expiresAtMs,
        });

        let swept = 0;
        for (const [key, bucket] of buckets) {
          if (swept >= MEMORY_EXPIRE_SWEEP) break;
          if (key === input.bucketKey) continue;
          if (input.nowEpochMs >= bucket.expiresAtMs) {
            buckets.delete(key);
            swept += 1;
          }
        }

        if (nextCount <= input.limit) {
          return {
            allowed: true,
            retryAfterSeconds: 0,
            hitCount: nextCount,
          };
        }

        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((expiresAtMs - input.nowEpochMs) / 1000),
          ),
          hitCount: nextCount,
        };
      });
    },
    check(input) {
      return queue.enqueue(() => {
        const expiresAtMs = input.windowStartEpochMs + input.windowMs;
        const current = buckets.get(input.bucketKey);
        const sameWindow =
          current !== undefined &&
          current.windowStartEpochMs === input.windowStartEpochMs &&
          input.nowEpochMs < current.expiresAtMs;
        const hitCount = sameWindow ? current.count : 0;
        if (hitCount >= input.limit) {
          return {
            allowed: false,
            retryAfterSeconds: Math.max(
              1,
              Math.ceil((expiresAtMs - input.nowEpochMs) / 1000),
            ),
            hitCount,
          };
        }
        return {
          allowed: true,
          retryAfterSeconds: 0,
          hitCount,
        };
      });
    },
    clearBucket(bucketKey) {
      return queue.enqueue(() => {
        buckets.delete(bucketKey);
      });
    },
    debugBucketKeys() {
      return [...buckets.keys()];
    },
    debugLiveRowCount() {
      return buckets.size;
    },
    clear() {
      buckets.clear();
    },
  };
}

export const failClosedAbuseRateLimitStore: AbuseRateLimitStore = {
  async consume() {
    return {
      allowed: false,
      retryAfterSeconds: 30,
      hitCount: 0,
    };
  },
  async check() {
    return {
      allowed: false,
      retryAfterSeconds: 30,
      hitCount: 0,
    };
  },
  async clearBucket() {
    return;
  },
};

const defaultMemoryStore = createMemoryAbuseRateLimitStore();

let testStore: AbuseRateLimitStore | null = null;

export function setAbuseRateLimitStoreForTests(
  store: AbuseRateLimitStore | null,
): void {
  testStore = store;
}

export function getTestAbuseRateLimitStore(): AbuseRateLimitStore | null {
  return testStore;
}

export function getMemoryAbuseRateLimitStore(): AbuseRateLimitStore {
  return defaultMemoryStore;
}

export function resetMemoryAbuseRateLimitStore(): void {
  defaultMemoryStore.clear?.();
}
