/**
 * Diamond Shape Studio QR capture smoke test (session integrity lifecycle).
 * Prerequisite: run lib/supabase/shape-studio-sessions-schema.sql (including
 * consumed/cancelled migration) and create private bucket `shape-studio-captures`.
 *
 * Usage (dev server running):
 *   npx tsx --env-file=.env.local scripts/shape-studio-qr-smoke-test.ts [baseUrl]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createShapeStudioSession,
  expireShapeStudioSessionForTest,
  getShapeStudioSession,
  resolveShapeStudioBackendForTest,
} from "../lib/shape-studio/sessions";
import { adoptRemoteCaptureImage } from "../lib/shape-studio/adopt-capture-image";
import {
  attemptAcknowledgeCaptureSession,
  createPostAdoptionAckController,
} from "../lib/shape-studio/post-adoption-ack";

const baseUrl = process.argv[2] ?? "http://localhost:3000";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sampleImage = path.join(
  __dirname,
  "../public/diamond-tech-suite/finger/finger-light.png",
);

const results: Array<{ ok: boolean; name: string; detail?: string }> = [];

function pass(name: string, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail = "") {
  results.push({ ok: false, name, detail });
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function jsonFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  return { res, body: body as Record<string, unknown> };
}

function imageForm(bytes: Buffer) {
  const fd = new FormData();
  fd.append("file", new Blob([bytes], { type: "image/png" }), "hand.png");
  return fd;
}

async function main() {
  console.log(`Shape Studio QR smoke test → ${baseUrl}`);
  const backend = await resolveShapeStudioBackendForTest();
  console.log(`Backend: ${backend}\n`);

  if (!fs.existsSync(sampleImage)) {
    fail("sample image exists", sampleImage);
    printSummary();
    process.exit(1);
  }

  const bytes = fs.readFileSync(sampleImage);

  const create = await jsonFetch(`${baseUrl}/api/shape-studio/sessions`, {
    method: "POST",
  });

  if (create.res.status === 503) {
    fail(
      "session create",
      "503 capture_unavailable — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY",
    );
    printSummary();
    process.exit(1);
  }

  if (create.res.status !== 200 || !create.body.sessionId) {
    const msg = String(create.body.message ?? JSON.stringify(create.body));
    fail("session create", `${create.res.status} ${msg}`);
    printSummary();
    process.exit(1);
  }

  const sessionId = String(create.body.sessionId);
  const captureUrl = String(create.body.captureUrl);
  const expiresAt = String(create.body.expiresAt);
  pass("session create", sessionId);

  const pollPending = await jsonFetch(
    `${baseUrl}/api/shape-studio/sessions/${sessionId}`,
  );
  if (pollPending.res.status === 200 && pollPending.body.status === "pending") {
    pass("poll pending");
  } else {
    fail("poll pending", JSON.stringify(pollPending.body));
  }

  const capturePage = await fetch(captureUrl);
  if (capturePage.status === 200) {
    const html = await capturePage.text();
    if (/Take or choose photo|Capture for Scaled Preview/i.test(html)) {
      pass("capture page loads for pending session");
    } else {
      pass("capture page loads", captureUrl);
    }
  } else {
    fail("capture page loads", `${capturePage.status}`);
  }

  const unknownId = "00000000-0000-4000-8000-000000000099";
  const unknownPage = await fetch(
    `${baseUrl}/diamond-shape-studio/capture/${unknownId}`,
  );
  if (unknownPage.status === 200) {
    const html = await unknownPage.text();
    if (/not valid|Capture unavailable|ended/i.test(html)) {
      pass("unknown session capture page blocked");
    } else {
      fail("unknown session capture page blocked", "missing recovery copy");
    }
  } else {
    fail("unknown session capture page", `${unknownPage.status}`);
  }

  const badId = await jsonFetch(
    `${baseUrl}/api/shape-studio/sessions/not-a-uuid`,
  );
  if (badId.res.status === 400) pass("invalid session id → 400");
  else fail("invalid session id", `${badId.res.status}`);

  const badTypeFd = new FormData();
  badTypeFd.append(
    "file",
    new Blob(["not an image"], { type: "text/plain" }),
    "test.txt",
  );
  const badType = await fetch(
    `${baseUrl}/api/shape-studio/sessions/${sessionId}/upload`,
    { method: "POST", body: badTypeFd },
  );
  const badTypeBody = (await badType.json().catch(() => ({}))) as {
    error?: string;
  };
  if (badType.status === 400 && badTypeBody.error === "unsupported_type") {
    pass("invalid file type → 400");
  } else {
    fail("invalid file type", `${badType.status}`);
  }

  const upload = await fetch(
    `${baseUrl}/api/shape-studio/sessions/${sessionId}/upload`,
    { method: "POST", body: imageForm(bytes) },
  );
  const uploadBody = (await upload.json().catch(() => ({}))) as {
    ok?: boolean;
    status?: string;
    message?: string;
  };
  if (upload.status === 200 && uploadBody.ok) {
    pass("hand photo upload → image_uploaded");
  } else {
    fail(
      "hand photo upload",
      `${upload.status} ${uploadBody.message ?? JSON.stringify(uploadBody)}`,
    );
    printSummary();
    process.exit(1);
  }

  const pollDone = await jsonFetch(
    `${baseUrl}/api/shape-studio/sessions/${sessionId}`,
  );
  if (
    pollDone.res.status === 200 &&
    pollDone.body.status === "image_uploaded" &&
    pollDone.body.imageUrl
  ) {
    pass("poll image_uploaded + signed URL (not consumed)");
    assertNotConsumed(pollDone.body.status);
    const img = await fetch(String(pollDone.body.imageUrl));
    if (img.ok) pass("signed URL fetchable before ack");
    else fail("signed URL fetchable", `${img.status}`);
  } else {
    fail("poll image_uploaded", JSON.stringify(pollDone.body));
  }

  const reupload = await fetch(
    `${baseUrl}/api/shape-studio/sessions/${sessionId}/upload`,
    { method: "POST", body: imageForm(bytes) },
  );
  if (reupload.status === 409) pass("re-upload → 409");
  else fail("re-upload → 409", `${reupload.status}`);

  // --- Post-adoption acknowledgement recovery (controller) ---
  {
    const recovery = await createShapeStudioSession();
    const upRec = await fetch(
      `${baseUrl}/api/shape-studio/sessions/${recovery.sessionId}/upload`,
      { method: "POST", body: imageForm(bytes) },
    );
    if (upRec.status !== 200) {
      fail("recovery upload", `${upRec.status}`);
    } else {
      const polled = await getShapeStudioSession(recovery.sessionId);
      const imageUrl = polled?.imageUrl;
      if (!imageUrl) {
        fail("recovery poll imageUrl");
      } else {
        let adoptCount = 0;
        let receiveCount = 0;
        let ackCalls = 0;
        let failOnce = true;
        const timeline: string[] = [];
        const controller = createPostAdoptionAckController({
          adoptRemote: async (url) => {
            adoptCount += 1;
            timeline.push("adopt");
            return adoptRemoteCaptureImage(url);
          },
          onImageReceived: () => {
            receiveCount += 1;
            timeline.push("received");
          },
          acknowledge: async (id) => {
            ackCalls += 1;
            if (failOnce) {
              failOnce = false;
              timeline.push("ack_fail");
              return { kind: "retryable", status: 500 };
            }
            timeline.push("ack_ok");
            return attemptAcknowledgeCaptureSession(
              id,
              (input, init) => {
                const path =
                  typeof input === "string"
                    ? input
                    : input instanceof URL
                      ? input.toString()
                      : input.url;
                const url = path.startsWith("http")
                  ? path
                  : `${baseUrl}${path}`;
                return fetch(url, init);
              },
            );
          },
          wait: async () => undefined,
        });
        controller.bindSession(recovery.sessionId);

        await assertRejectsAckRetryable(() =>
          controller.handleImageReady(recovery.sessionId, imageUrl),
        );
        if (
          adoptCount === 1 &&
          receiveCount === 1 &&
          ackCalls === 1 &&
          controller.getAdoptedSessionId() === recovery.sessionId
        ) {
          pass("ack recovery: adopt once, first ack fails, session retained");
        } else {
          fail(
            "ack recovery after first fail",
            JSON.stringify({ adoptCount, receiveCount, ackCalls, timeline }),
          );
        }

        const mid = await getShapeStudioSession(recovery.sessionId);
        if (mid?.status === "image_uploaded" && mid.imageUrl) {
          pass("ack recovery: still image_uploaded after failed ack");
        } else {
          fail("ack recovery mid status", JSON.stringify(mid));
        }

        const outcome = await controller.handleImageReady(
          recovery.sessionId,
          imageUrl,
        );
        if (
          outcome === "cleared" &&
          adoptCount === 1 &&
          receiveCount === 1 &&
          ackCalls === 2
        ) {
          pass("ack recovery: second ack succeeds without readopt");
        } else {
          fail(
            "ack recovery second ack",
            JSON.stringify({ outcome, adoptCount, receiveCount, ackCalls, timeline }),
          );
        }

        const done = await getShapeStudioSession(recovery.sessionId);
        if (done?.status === "consumed" && !done.imageUrl) {
          pass("ack recovery: consumed + object deleted");
        } else {
          fail("ack recovery final", JSON.stringify(done));
        }

        // Cancel during retry
        const cancelRetry = await createShapeStudioSession();
        await fetch(
          `${baseUrl}/api/shape-studio/sessions/${cancelRetry.sessionId}/upload`,
          { method: "POST", body: imageForm(bytes) },
        );
        const cancelPolled = await getShapeStudioSession(cancelRetry.sessionId);
        let cancelReceive = 0;
        const cancelController = createPostAdoptionAckController({
          adoptRemote: adoptRemoteCaptureImage,
          onImageReceived: () => {
            cancelReceive += 1;
          },
          acknowledge: async () => ({ kind: "retryable", status: 500 }),
          wait: async () => undefined,
        });
        cancelController.bindSession(cancelRetry.sessionId);
        if (cancelPolled?.imageUrl) {
          await assertRejectsAckRetryable(() =>
            cancelController.handleImageReady(
              cancelRetry.sessionId,
              cancelPolled.imageUrl!,
            ),
          );
        }
        cancelController.cancelLocal();
        await jsonFetch(
          `${baseUrl}/api/shape-studio/sessions/${cancelRetry.sessionId}`,
          { method: "DELETE" },
        );
        await assertRejectsStale(() =>
          cancelController.handleImageReady(
            cancelRetry.sessionId,
            cancelPolled?.imageUrl ?? "https://example.invalid/x",
          ),
        );
        if (cancelReceive === 1) {
          pass("ack recovery: cancel during retry preserves adoption, blocks late ack");
        } else {
          fail("ack recovery cancel receive", `receive=${cancelReceive}`);
        }
        const afterCancelRetry = await getShapeStudioSession(
          cancelRetry.sessionId,
        );
        if (afterCancelRetry?.status === "cancelled") {
          pass("ack recovery: session cancelled after retry cancel");
        } else {
          fail("ack recovery cancel status", JSON.stringify(afterCancelRetry));
        }
      }
    }
  }

  const ack = await jsonFetch(
    `${baseUrl}/api/shape-studio/sessions/${sessionId}/acknowledge`,
    { method: "POST" },
  );
  if (ack.res.status === 200 && ack.body.status === "consumed") {
    pass("acknowledge → consumed + delete");
  } else {
    fail("acknowledge", `${ack.res.status} ${JSON.stringify(ack.body)}`);
  }

  const pollConsumed = await jsonFetch(
    `${baseUrl}/api/shape-studio/sessions/${sessionId}`,
  );
  if (
    pollConsumed.res.status === 200 &&
    pollConsumed.body.status === "consumed" &&
    !pollConsumed.body.imageUrl
  ) {
    pass("poll consumed tombstone without imageUrl");
  } else {
    fail("poll consumed", JSON.stringify(pollConsumed.body));
  }

  const ackAgain = await jsonFetch(
    `${baseUrl}/api/shape-studio/sessions/${sessionId}/acknowledge`,
    { method: "POST" },
  );
  if (ackAgain.res.status === 200 && ackAgain.body.status === "consumed") {
    pass("acknowledge idempotent");
  } else {
    fail("acknowledge idempotent", `${ackAgain.res.status}`);
  }

  // Cancel before upload
  const cancelSession = await createShapeStudioSession();
  const cancelRes = await jsonFetch(
    `${baseUrl}/api/shape-studio/sessions/${cancelSession.sessionId}`,
    { method: "DELETE" },
  );
  if (cancelRes.res.status === 200) pass("cancel pending session");
  else fail("cancel pending", `${cancelRes.res.status}`);

  const cancelUpload = await fetch(
    `${baseUrl}/api/shape-studio/sessions/${cancelSession.sessionId}/upload`,
    { method: "POST", body: imageForm(bytes) },
  );
  if (cancelUpload.status === 410) pass("upload after cancel → 410");
  else fail("upload after cancel", `${cancelUpload.status}`);

  // Cancel after upload deletes object
  const cancelAfter = await createShapeStudioSession();
  const up2 = await fetch(
    `${baseUrl}/api/shape-studio/sessions/${cancelAfter.sessionId}/upload`,
    { method: "POST", body: imageForm(bytes) },
  );
  if (up2.status !== 200) {
    fail("upload before cancel-after", `${up2.status}`);
  } else {
    const del = await jsonFetch(
      `${baseUrl}/api/shape-studio/sessions/${cancelAfter.sessionId}`,
      { method: "DELETE" },
    );
    if (del.res.status === 200) pass("cancel after upload");
    else fail("cancel after upload", `${del.res.status}`);

    const afterCancel = await getShapeStudioSession(cancelAfter.sessionId);
    if (afterCancel?.status === "cancelled" && !afterCancel.imageUrl) {
      pass("cancelled session has no imageUrl");
    } else {
      fail("cancelled poll", JSON.stringify(afterCancel));
    }
  }

  // Expire
  const expiredSession = await createShapeStudioSession();
  await expireShapeStudioSessionForTest(expiredSession.sessionId);
  const expired = await getShapeStudioSession(expiredSession.sessionId);
  if (expired?.status === "expired") pass("expired session poll → expired");
  else fail("expired session poll", JSON.stringify(expired));

  const expiredUpload = await fetch(
    `${baseUrl}/api/shape-studio/sessions/${expiredSession.sessionId}/upload`,
    { method: "POST", body: imageForm(bytes) },
  );
  if (expiredUpload.status === 410) pass("expired upload → 410");
  else fail("expired upload → 410", `${expiredUpload.status}`);

  const studioPage = await fetch(`${baseUrl}/diamond-shape-studio`);
  if (studioPage.status === 200) pass("shape studio page loads");
  else fail("shape studio page", `${studioPage.status}`);

  console.log(`\nCapture URL example: ${captureUrl}`);
  console.log(`Session expiresAt: ${expiresAt}`);
  printSummary();
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

function assertNotConsumed(status: unknown) {
  if (status === "consumed") {
    fail("poll must not consume on signed URL alone");
  }
}

async function assertRejectsAckRetryable(fn: () => Promise<unknown>) {
  try {
    await fn();
    fail("expected ack_retryable");
  } catch (err) {
    if (err instanceof Error && err.message === "ack_retryable") return;
    fail("expected ack_retryable", String(err));
  }
}

async function assertRejectsStale(fn: () => Promise<unknown>) {
  try {
    await fn();
    fail("expected stale_session");
  } catch (err) {
    if (err instanceof Error && /stale_session|controller_disposed/.test(err.message)) {
      return;
    }
    fail("expected stale_session", String(err));
  }
}

function printSummary() {
  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n--- ${results.length - failed.length}/${results.length} passed ---`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
