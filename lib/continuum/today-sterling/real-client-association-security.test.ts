import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("real-client association Preview review security", () => {
  it("is founder-authenticated, Preview-only, and read-only", () => {
    const page = readFileSync(resolve("app/executive-dashboard/concierge/sterling-today/associations/page.tsx"), "utf8");
    const loader = readFileSync(resolve("lib/continuum/today-sterling/real-client-association-load.ts"), "utf8");
    assert.match(page, /requireInternalClientMemorySession/);
    assert.match(page, /isVerifiedSterlingTodayPreviewRuntime/);
    assert.match(page, /read only/i);
    assert.doesNotMatch(page + loader, /\.insert\(|\.upsert\(|\.update\(|\.delete\(/);
    assert.doesNotMatch(page + loader, /refreshAccessToken|createProposal|publishSterling|generateText|generateObject/);
  });

  it("paginates beyond the Supabase default result cap", () => {
    const loader = readFileSync(resolve("lib/continuum/today-sterling/real-client-association-load.ts"), "utf8");
    assert.match(loader, /PAGE_SIZE = 1000/);
    assert.match(loader, /\.range\(from, from \+ PAGE_SIZE - 1\)/);
    assert.match(loader, /if \(page\.length < PAGE_SIZE\) break/);
  });

  it("does not let a server refreshing prop pin Today to checking forever", () => {
    const component = readFileSync(resolve("app/executive-dashboard/concierge/components/gmail-operating-freshness.tsx"), "utf8");
    assert.match(component, /const activelyChecking = !refreshUnavailable && checking;/);
    assert.doesNotMatch(component, /refreshing \|\| checking/);
  });
});
