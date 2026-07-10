import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACK_BACKOFF_MS,
  attemptAcknowledgeCaptureSession,
  createPostAdoptionAckController,
  nextAckBackoffMs,
  type AcknowledgeAttemptResult,
} from "./post-adoption-ack";

describe("ack backoff", () => {
  it("uses restrained intervals", () => {
    assert.deepEqual([...ACK_BACKOFF_MS], [1500, 3000, 5000, 10_000]);
    assert.equal(nextAckBackoffMs(0), 1500);
    assert.equal(nextAckBackoffMs(1), 3000);
    assert.equal(nextAckBackoffMs(2), 5000);
    assert.equal(nextAckBackoffMs(3), 10_000);
    assert.equal(nextAckBackoffMs(99), 10_000);
  });
});

describe("attemptAcknowledgeCaptureSession", () => {
  it("treats HTTP 200 consumed as already_consumed", async () => {
    const result = await attemptAcknowledgeCaptureSession(
      "a1b2c3d4-e5f6-4789-a012-3456789abcde",
      (async () =>
        new Response(JSON.stringify({ ok: true, status: "consumed" }), {
          status: 200,
        })) as typeof fetch,
    );
    assert.equal(result.kind, "already_consumed");
  });

  it("treats network failure as retryable", async () => {
    const result = await attemptAcknowledgeCaptureSession(
      "a1b2c3d4-e5f6-4789-a012-3456789abcde",
      (async () => {
        throw new TypeError("network");
      }) as typeof fetch,
    );
    assert.equal(result.kind, "retryable");
  });

  it("treats HTTP 5xx as retryable", async () => {
    const result = await attemptAcknowledgeCaptureSession(
      "a1b2c3d4-e5f6-4789-a012-3456789abcde",
      (async () => new Response("err", { status: 503 })) as typeof fetch,
    );
    assert.equal(result.kind, "retryable");
    if (result.kind === "retryable") assert.equal(result.status, 503);
  });

  it("treats 404 as terminal not_found", async () => {
    const result = await attemptAcknowledgeCaptureSession(
      "a1b2c3d4-e5f6-4789-a012-3456789abcde",
      (async () => new Response("{}", { status: 404 })) as typeof fetch,
    );
    assert.equal(result.kind, "terminal");
    if (result.kind === "terminal") assert.equal(result.reason, "not_found");
  });

  it("treats 409 as terminal no_image", async () => {
    const result = await attemptAcknowledgeCaptureSession(
      "a1b2c3d4-e5f6-4789-a012-3456789abcde",
      (async () => new Response("{}", { status: 409 })) as typeof fetch,
    );
    assert.equal(result.kind, "terminal");
    if (result.kind === "terminal") assert.equal(result.reason, "no_image");
  });
});

describe("createPostAdoptionAckController", () => {
  const SESSION = "a1b2c3d4-e5f6-4789-a012-3456789abcde";
  const SESSION_B = "b2c3d4e5-f6a7-4890-b123-456789abcdef";

  function setup(ackResults: AcknowledgeAttemptResult[]) {
    const waits: number[] = [];
    let adoptCount = 0;
    let receiveCount = 0;
    let ackCount = 0;
    const objectUrls: string[] = [];
    const received: string[] = [];

    const controller = createPostAdoptionAckController({
      adoptRemote: async () => {
        adoptCount += 1;
        const url = `blob:adopted-${adoptCount}`;
        objectUrls.push(url);
        return { objectUrl: url };
      },
      onImageReceived: (url) => {
        receiveCount += 1;
        received.push(url);
      },
      acknowledge: async () => {
        const next = ackResults[ackCount] ?? { kind: "retryable" as const };
        ackCount += 1;
        return next;
      },
      wait: async (ms) => {
        waits.push(ms);
      },
    });

    controller.bindSession(SESSION);

    return {
      controller,
      waits,
      stats: () => ({ adoptCount, receiveCount, ackCount, objectUrls, received }),
    };
  }

  it("adopts once, retries ack without redownload, clears only after success", async () => {
    const { controller, waits, stats } = setup([
      { kind: "retryable", status: 500 },
      { kind: "success" },
    ]);

    await assert.rejects(
      () => controller.handleImageReady(SESSION, "https://example.invalid/a"),
      /ack_retryable/,
    );
    assert.equal(stats().adoptCount, 1);
    assert.equal(stats().receiveCount, 1);
    assert.equal(stats().ackCount, 1);
    assert.equal(controller.getAdoptedSessionId(), SESSION);
    assert.equal(controller.getActiveSessionId(), SESSION);

    const firstUrl = stats().received[0];
    const outcome = await controller.handleImageReady(
      SESSION,
      "https://example.invalid/should-not-fetch",
    );
    assert.equal(outcome, "cleared");
    assert.equal(stats().adoptCount, 1);
    assert.equal(stats().receiveCount, 1);
    assert.equal(stats().ackCount, 2);
    assert.equal(stats().received[0], firstUrl);
    assert.deepEqual(waits, [1500]);
    assert.equal(controller.getAdoptedSessionId(), null);
    assert.equal(controller.getActiveSessionId(), null);
  });

  it("keeps retrying across multiple acknowledgement failures", async () => {
    const { controller, stats } = setup([
      { kind: "retryable" },
      { kind: "retryable", status: 503 },
      { kind: "retryable" },
      { kind: "success" },
    ]);

    for (let i = 0; i < 3; i++) {
      await assert.rejects(
        () => controller.handleImageReady(SESSION, "https://example.invalid/a"),
        /ack_retryable/,
      );
    }
    assert.equal(stats().adoptCount, 1);
    assert.equal(stats().receiveCount, 1);
    assert.equal(stats().ackCount, 3);

    const outcome = await controller.handleImageReady(
      SESSION,
      "https://example.invalid/a",
    );
    assert.equal(outcome, "cleared");
    assert.equal(stats().adoptCount, 1);
    assert.equal(stats().ackCount, 4);
  });

  it("treats already_consumed as success and clears once", async () => {
    const { controller, stats } = setup([{ kind: "already_consumed" }]);
    const outcome = await controller.handleImageReady(
      SESSION,
      "https://example.invalid/a",
    );
    assert.equal(outcome, "cleared");
    assert.equal(stats().adoptCount, 1);
    assert.equal(stats().ackCount, 1);
    assert.equal(controller.getActiveSessionId(), null);
    assert.equal(controller.getAdoptedSessionId(), null);
  });

  it("already_consumed after prior failure clears without readopt", async () => {
    const { controller, stats } = setup([
      { kind: "retryable" },
      { kind: "already_consumed" },
    ]);
    await assert.rejects(
      () => controller.handleImageReady(SESSION, "https://example.invalid/a"),
      /ack_retryable/,
    );
    const outcome = await controller.handleImageReady(
      SESSION,
      "https://example.invalid/a",
    );
    assert.equal(outcome, "cleared");
    assert.equal(stats().adoptCount, 1);
    assert.equal(stats().receiveCount, 1);
  });

  it("cancelled/no_image terminal stops retries but keeps adoption side effects", async () => {
    const { controller, stats } = setup([
      { kind: "retryable" },
      { kind: "terminal", reason: "no_image" },
    ]);
    await assert.rejects(
      () => controller.handleImageReady(SESSION, "https://example.invalid/a"),
      /ack_retryable/,
    );
    assert.equal(stats().receiveCount, 1);
    const outcome = await controller.handleImageReady(
      SESSION,
      "https://example.invalid/a",
    );
    assert.equal(outcome, "terminal_cleared");
    assert.equal(stats().adoptCount, 1);
    assert.equal(stats().receiveCount, 1);
    assert.equal(controller.getAdoptedSessionId(), null);
  });

  it("expired terminal stops retries and preserves prior receive", async () => {
    const { controller, stats } = setup([
      { kind: "terminal", reason: "expired" },
    ]);
    // Need adoption first — terminal on first ack after adopt
    const outcome = await controller.handleImageReady(
      SESSION,
      "https://example.invalid/a",
    );
    assert.equal(outcome, "terminal_cleared");
    assert.equal(stats().receiveCount, 1);
  });

  it("unknown/not_found terminal stops safely after adoption", async () => {
    const { controller, stats } = setup([
      { kind: "terminal", reason: "not_found" },
    ]);
    const outcome = await controller.handleImageReady(
      SESSION,
      "https://example.invalid/a",
    );
    assert.equal(outcome, "terminal_cleared");
    assert.equal(stats().receiveCount, 1);
  });

  it("user cancel during retry prevents later acknowledgement success from clearing new work", async () => {
    const ackResults: AcknowledgeAttemptResult[] = [
      { kind: "retryable" },
      { kind: "success" },
    ];
    let ackCount = 0;
    let receiveCount = 0;
    const controller = createPostAdoptionAckController({
      adoptRemote: async () => ({ objectUrl: "blob:a" }),
      onImageReceived: () => {
        receiveCount += 1;
      },
      acknowledge: async () => {
        const r = ackResults[ackCount] ?? { kind: "success" as const };
        ackCount += 1;
        return r;
      },
      wait: async () => undefined,
    });
    controller.bindSession(SESSION);
    await assert.rejects(
      () => controller.handleImageReady(SESSION, "https://example.invalid/a"),
      /ack_retryable/,
    );
    assert.equal(receiveCount, 1);

    controller.cancelLocal();
    await assert.rejects(
      () => controller.handleImageReady(SESSION, "https://example.invalid/a"),
      /stale_session/,
    );
    assert.equal(ackCount, 1);
  });

  it("stale acknowledgement cannot clear a newer session", async () => {
    const ackWaiters: Array<(result: AcknowledgeAttemptResult) => void> = [];
    let receiveCount = 0;
    const controller = createPostAdoptionAckController({
      adoptRemote: async (url) => ({ objectUrl: `blob:${url}` }),
      onImageReceived: () => {
        receiveCount += 1;
      },
      acknowledge: () =>
        new Promise<AcknowledgeAttemptResult>((resolve) => {
          ackWaiters.push(resolve);
        }),
      wait: async () => undefined,
    });

    controller.bindSession(SESSION);
    const first = controller.handleImageReady(
      SESSION,
      "https://example.invalid/old",
    );

    // Let first adoption finish and park on ack.
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(receiveCount, 1);
    assert.equal(ackWaiters.length, 1);

    controller.bindSession(SESSION_B);
    const second = controller.handleImageReady(
      SESSION_B,
      "https://example.invalid/new",
    );
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(receiveCount, 2);
    assert.equal(ackWaiters.length, 2);

    // Late success for the old session must not clear the new one.
    ackWaiters[0]!({ kind: "success" });
    await assert.rejects(() => first, /stale_session/);
    assert.equal(controller.getActiveSessionId(), SESSION_B);

    ackWaiters[1]!({ kind: "success" });
    assert.equal(await second, "cleared");
    assert.equal(controller.getActiveSessionId(), null);
  });

  it("concurrent handleImageReady does not duplicate acknowledgement", async () => {
    let ackCount = 0;
    let adoptCount = 0;
    const controller = createPostAdoptionAckController({
      adoptRemote: async () => {
        adoptCount += 1;
        await new Promise((r) => setTimeout(r, 5));
        return { objectUrl: "blob:x" };
      },
      onImageReceived: () => undefined,
      acknowledge: async () => {
        ackCount += 1;
        await new Promise((r) => setTimeout(r, 20));
        return { kind: "success" };
      },
      wait: async () => undefined,
    });
    controller.bindSession(SESSION);

    const a = controller.handleImageReady(SESSION, "https://example.invalid/a");
    const b = controller.handleImageReady(SESSION, "https://example.invalid/a");
    const results = await Promise.allSettled([a, b]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.ok(rejected.length >= 1);
    assert.equal(adoptCount, 1);
    assert.equal(ackCount, 1);
  });

  it("new capture session clears prior adopted marker", async () => {
    const { controller, stats } = setup([{ kind: "retryable" }]);
    await assert.rejects(
      () => controller.handleImageReady(SESSION, "https://example.invalid/a"),
      /ack_retryable/,
    );
    assert.equal(controller.getAdoptedSessionId(), SESSION);

    controller.bindSession(SESSION_B);
    assert.equal(controller.getAdoptedSessionId(), null);

    await assert.rejects(
      () => controller.handleImageReady(SESSION_B, "https://example.invalid/b"),
      /ack_retryable/,
    );
    assert.equal(stats().adoptCount, 2);
    assert.equal(stats().receiveCount, 2);
  });

  it("dispose prevents further work and cleans retry identity", async () => {
    const { controller } = setup([{ kind: "retryable" }]);
    await assert.rejects(
      () => controller.handleImageReady(SESSION, "https://example.invalid/a"),
      /ack_retryable/,
    );
    controller.dispose();
    await assert.rejects(
      () => controller.handleImageReady(SESSION, "https://example.invalid/a"),
      /controller_disposed|stale_session/,
    );
  });
});
