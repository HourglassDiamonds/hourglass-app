import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { checkShapeStudioRateLimit } from "./rate-limit";
import { isValidSessionId } from "./session-id";
import {
  createMemoryAbuseRateLimitStore,
  resetMemoryAbuseRateLimitStore,
  setAbuseRateLimitStoreForTests,
} from "@/lib/security/abuse-rate-limit-store";

describe("Shape Studio rate limits", () => {
  beforeEach(() => {
    resetMemoryAbuseRateLimitStore();
    setAbuseRateLimitStoreForTests(null);
  });

  afterEach(() => {
    resetMemoryAbuseRateLimitStore();
    setAbuseRateLimitStoreForTests(null);
  });

  it("limits session creation floods from one client", async () => {
    const now = Date.now();
    for (let i = 0; i < 5; i += 1) {
      assert.equal(
        (await checkShapeStudioRateLimit("create", "198.51.100.10", now + i))
          .allowed,
        true,
      );
    }
    const blocked = await checkShapeStudioRateLimit(
      "create",
      "198.51.100.10",
      now + 5,
    );
    assert.equal(blocked.allowed, false);
  });

  it("limits upload floods from one client", async () => {
    const now = Date.now();
    for (let i = 0; i < 8; i += 1) {
      assert.equal(
        (await checkShapeStudioRateLimit("upload", "198.51.100.11", now + i))
          .allowed,
        true,
      );
    }
    assert.equal(
      (await checkShapeStudioRateLimit("upload", "198.51.100.11", now + 8))
        .allowed,
      false,
    );
  });

  it("allows a normal camera/upload burst", async () => {
    const now = Date.now();
    for (let i = 0; i < 4; i += 1) {
      assert.equal(
        (await checkShapeStudioRateLimit("upload", "198.51.100.12", now + i))
          .allowed,
        true,
      );
    }
  });

  it("does not reset upload limits when the caller invents new session ids", async () => {
    const now = Date.now();
    const ip = "198.51.100.13";
    for (let i = 0; i < 8; i += 1) {
      assert.equal(
        (await checkShapeStudioRateLimit("upload", ip, now + i)).allowed,
        true,
      );
    }
    assert.equal(
      isValidSessionId("3fa85f64-5717-4562-b3fc-2c963f66afa6"),
      true,
    );
    assert.equal(
      (await checkShapeStudioRateLimit("upload", ip, now + 8)).allowed,
      false,
    );
  });

  it("still requires a valid session id independently of the limiter", () => {
    assert.equal(isValidSessionId("not-a-session"), false);
    assert.equal(isValidSessionId(""), false);
    assert.equal(
      isValidSessionId("3fa85f64-5717-4562-b3fc-2c963f66afa6"),
      true,
    );
  });

  it("keeps hashed keys free of raw IPs", async () => {
    const store = createMemoryAbuseRateLimitStore();
    const ip = "203.0.113.88";
    await checkShapeStudioRateLimit("create", ip, Date.now(), store);
    const keys = store.debugBucketKeys?.() ?? [];
    assert.ok(keys.length >= 1);
    for (const key of keys) {
      assert.match(key, /^[a-f0-9]{64}$/);
      assert.equal(key.includes(ip), false);
    }
  });
});
