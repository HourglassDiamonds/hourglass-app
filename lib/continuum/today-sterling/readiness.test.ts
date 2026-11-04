import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("Sterling readiness preflight", () => {
  it("is founder-authenticated, Preview-only, aggregate-only, and read-only", () => {
    const source = readFileSync(join(ROOT, "lib/continuum/today-sterling/readiness.ts"), "utf8");
    assert.match(source, /isVerifiedSterlingTodayPreviewRuntime/);
    assert.match(source, /requireInternalClientMemorySession/);
    assert.match(source, /publisher-disabled/);
    assert.match(source, /token-kek-missing|loadGmailTokenKek/);
    assert.match(source, /new-ingestion-required-after-authorization/);
    assert.match(source, /successfulIngestionAfterAuthorization/);
    assert.doesNotMatch(source, /\.insert\(|\.upsert\(|\.delete\(|\.from\([^)]*\)[\s\S]{0,80}\.update\(/);
    assert.doesNotMatch(source, /server-runner|generateObject|generateText|createProposal|publishPersisted/);
  });

  it("does not expose message content, credentials, or raw evidence identities", () => {
    const page = readFileSync(join(ROOT, "app/executive-dashboard/concierge/sterling-today/readiness/page.tsx"), "utf8");
    const source = readFileSync(join(ROOT, "lib/continuum/today-sterling/readiness.ts"), "utf8");
    assert.doesNotMatch(page, /refreshToken|messageId|sourceRef|subject|snippet|plainText/);
    assert.doesNotMatch(source, /CONTINUUM_GMAIL_OAUTH_CLIENT_SECRET.*return|refreshToken:/);
    assert.match(page, /does not contact Gmail, run a model, create a proposal/);
  });

  it("keeps Today fail-soft only at the live correspondence boundary", () => {
    const load = readFileSync(join(ROOT, "lib/continuum/chief-of-staff/operating-loop/load.ts"), "utf8");
    assert.match(load, /threadIds: critical\.eligible,[\s\S]*requireComplete: false/);
    assert.match(load, /todayCorrespondenceStatus/);
    assert.match(load, /today-live-enrichment-required-set-moved/);
    assert.match(load, /authenticated_read_failed/);
  });
});
