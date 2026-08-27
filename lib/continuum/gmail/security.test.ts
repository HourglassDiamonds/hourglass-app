import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { assessGmailOAuthProductionReadiness } from "./oauth-readiness";

const GMAIL_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(GMAIL_DIR, "../../..");

function walk(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

describe("Gmail activation security", () => {
  it("keeps the Supabase adapter server-only", () => {
    const server = readFileSync(join(GMAIL_DIR, "server.ts"), "utf8");
    const barrel = readFileSync(join(GMAIL_DIR, "index.ts"), "utf8");
    assert.match(server, /import "server-only"/);
    assert.match(server, /createSupabaseGmailConnectionStore/);
    assert.doesNotMatch(barrel, /createSupabaseGmailConnectionStore/);
    assert.doesNotMatch(barrel, /from "\.\/supabase"/);
    assert.doesNotMatch(barrel, /from "\.\/server"/);
  });

  it("does not log or persist Gmail content, tokens, or canonical writes", () => {
    for (const file of walk(GMAIL_DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /insertEvent|insertEvidence|insertObservation/);
      assert.doesNotMatch(source, /continuum_events|continuum_observations/);
      assert.doesNotMatch(source, /continuum_person_profiles|continuum_person_facts/);
      assert.doesNotMatch(source, /insertSourceNote|insertWish|createPersonAtomic/);
      assert.doesNotMatch(source, /GOOGLE_REFRESH_TOKEN|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET/);
      assert.doesNotMatch(source, /NEXT_PUBLIC_CONTINUUM_GMAIL/);
      assert.doesNotMatch(source, /\/messages\/[^?\s"'`]+\/attachments\//);
    }
  });

  it("does not attach Gmail index writes to public API routes", () => {
    const apiFiles = walk(join(ROOT, "app/api"), ".ts");
    assert.ok(apiFiles.length > 0);
    for (const file of apiFiles) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /client-memory\/gmail/);
      assert.doesNotMatch(source, /createSupabaseGmailIndexStore/);
      assert.doesNotMatch(source, /InMemoryGmailIndexStore/);
    }
  });

  it("keeps OAuth routes off mailbox content and token rendering", () => {
    const start = readFileSync(
      join(ROOT, "app/api/continuum/gmail/oauth/start/route.ts"),
      "utf8",
    );
    const callback = readFileSync(
      join(ROOT, "app/api/continuum/gmail/oauth/callback/route.ts"),
      "utf8",
    );
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail-actions.ts"),
      "utf8",
    );
    for (const source of [start, callback]) {
      assert.doesNotMatch(source, /refresh_token|access_token|auth-code/);
      assert.doesNotMatch(source, /subject|snippet|payload/);
      assert.match(source, /force-dynamic/);
    }
    assert.match(start, /handleGmailOAuthStart/);
    assert.match(callback, /handleGmailOAuthCallback/);
    assert.match(actions, /"use server"/);
    assert.doesNotMatch(actions, /GOOGLE_REFRESH_TOKEN/);
  });

  it("documents the restricted gmail.readonly scope only", () => {
    const types = readFileSync(join(GMAIL_DIR, "types.ts"), "utf8");
    const oauth = readFileSync(join(GMAIL_DIR, "oauth.ts"), "utf8");
    assert.match(types, /https:\/\/www\.googleapis\.com\/auth\/gmail\.readonly/);
    assert.match(oauth, /GMAIL_READONLY_SCOPE/);
    assert.doesNotMatch(oauth, /gmail\.modify|gmail\.compose|gmail\.insert|mail\.google\.com/);
    assert.doesNotMatch(oauth, /analytics\.readonly|webmasters\.readonly/);
  });

  it("does not print founder email or secrets in the OAuth readiness assessment", () => {
    const report = assessGmailOAuthProductionReadiness();
    const serialized = JSON.stringify(report);
    assert.equal(serialized.includes("@"), false);
    assert.doesNotMatch(serialized, /CLIENT_SECRET|TOKEN_KEK|refresh-token|founder@/i);
    assert.equal(report.mailboxHosting, "unknown");
    assert.equal(
      report.configurationGate,
      "FOUNDER / GOOGLE CLOUD CONFIGURATION REQUIRED BEFORE ACTIVATION",
    );
  });
});
