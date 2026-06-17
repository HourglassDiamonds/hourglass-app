/**
 * Diamond Shape Studio QR capture smoke test.
 * Prerequisite: run lib/supabase/shape-studio-sessions-schema.sql and create
 * private bucket `shape-studio-captures` in Supabase Storage.
 *
 * Usage (dev server running):
 *   npx tsx scripts/shape-studio-qr-smoke-test.ts [baseUrl]
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

async function main() {
  console.log(`Shape Studio QR smoke test → ${baseUrl}`);
  const backend = await resolveShapeStudioBackendForTest();
  console.log(`Backend: ${backend}\n`);

  if (!fs.existsSync(sampleImage)) {
    fail("sample image exists", sampleImage);
    printSummary();
    process.exit(1);
  }

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
    if (msg.includes("shape_studio_sessions")) {
      fail(
        "session create",
        "Table missing — run lib/supabase/shape-studio-sessions-schema.sql in Supabase SQL editor",
      );
    } else {
      fail("session create", `${create.res.status} ${msg}`);
    }
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
  if (capturePage.status === 200) pass("capture page loads", captureUrl);
  else fail("capture page loads", `${capturePage.status}`);

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
    message?: string;
  };
  if (badType.status === 400 && badTypeBody.error === "unsupported_type") {
    pass("invalid file type → 400", badTypeBody.message);
  } else {
    fail("invalid file type", `${badType.status} ${JSON.stringify(badTypeBody)}`);
  }

  const bytes = fs.readFileSync(sampleImage);
  const uploadFd = new FormData();
  uploadFd.append(
    "file",
    new Blob([bytes], { type: "image/png" }),
    "hand.png",
  );

  const upload = await fetch(
    `${baseUrl}/api/shape-studio/sessions/${sessionId}/upload`,
    { method: "POST", body: uploadFd },
  );
  const uploadBody = (await upload.json().catch(() => ({}))) as { ok?: boolean; message?: string };
  if (upload.status === 200 && uploadBody.ok) pass("hand photo upload");
  else {
    fail(
      "hand photo upload",
      `${upload.status} ${uploadBody.message ?? JSON.stringify(uploadBody)}`,
    );
    if (String(uploadBody.message ?? "").includes("Bucket not found")) {
      console.error(
        "\nHint: create private Storage bucket `shape-studio-captures` in Supabase Dashboard.\n",
      );
    }
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
    pass("poll image_uploaded + signed URL");
    const img = await fetch(String(pollDone.body.imageUrl));
    if (img.ok) pass("signed URL fetchable", `${img.status}`);
    else fail("signed URL fetchable", `${img.status}`);
  } else {
    fail("poll image_uploaded", JSON.stringify(pollDone.body));
  }

  const reupload = await fetch(
    `${baseUrl}/api/shape-studio/sessions/${sessionId}/upload`,
    { method: "POST", body: uploadFd },
  );
  const reuploadBody = (await reupload.json().catch(() => ({}))) as {
    message?: string;
  };
  if (reupload.status === 409) {
    pass("re-upload → 409", reuploadBody.message);
  } else {
    fail("re-upload → 409", `${reupload.status} ${JSON.stringify(reuploadBody)}`);
  }

  const expiredSession = await createShapeStudioSession();
  await expireShapeStudioSessionForTest(expiredSession.sessionId);

  const expired = await getShapeStudioSession(expiredSession.sessionId);
  if (expired?.status === "expired") pass("expired session poll → expired");
  else fail("expired session poll", JSON.stringify(expired));

  const expiredUpload = await fetch(
    `${baseUrl}/api/shape-studio/sessions/${expiredSession.sessionId}/upload`,
    { method: "POST", body: uploadFd },
  );
  const expiredUploadBody = (await expiredUpload.json().catch(() => ({}))) as {
    message?: string;
  };
  if (expiredUpload.status === 410) {
    pass("expired upload → 410", expiredUploadBody.message);
  } else {
    fail(
      "expired upload → 410",
      `${expiredUpload.status} ${JSON.stringify(expiredUploadBody)}`,
    );
  }

  const studioPage = await fetch(`${baseUrl}/diamond-shape-studio`);
  if (studioPage.status === 200) pass("shape studio page loads");
  else fail("shape studio page", `${studioPage.status}`);

  console.log(`\nCapture URL example: ${captureUrl}`);
  console.log(`Session expiresAt: ${expiresAt}`);
  printSummary();
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
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
