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
      const normalized = file.replace(/\\/g, "/");
      if (normalized.endsWith("/known-artifact-gmail.ts")) {
        assert.match(source, /\/messages\/\$\{encodeURIComponent\(messageId\)\}\/attachments\//);
        assert.doesNotMatch(source, /listMessages\(|getMessage\(|getThread\(/);
      } else {
        assert.doesNotMatch(source, /\/messages\/[^?\s"'`]+\/attachments\//);
      }
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
      assert.doesNotMatch(source, /runExactProjectThreadFetch|protectExactThread/);
      assert.doesNotMatch(source, /executeAchedekalCandidateDiscovery/);
      assert.doesNotMatch(source, /executeAchedekalKnownArtifactPreview/);
    }
  });

  it("keeps exact project thread fetch server-only, evidence-only, and off public routes", () => {
    const exact = readFileSync(join(GMAIL_DIR, "exact-thread.ts"), "utf8");
    const payload = readFileSync(join(GMAIL_DIR, "exact-thread-payload.ts"), "utf8");
    const evidence = readFileSync(join(GMAIL_DIR, "reconstruction-evidence.ts"), "utf8");
    const server = readFileSync(join(GMAIL_DIR, "server.ts"), "utf8");
    const barrel = readFileSync(join(GMAIL_DIR, "index.ts"), "utf8");
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail-actions.ts"),
      "utf8",
    );
    const historyActions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail-history-actions.ts"),
      "utf8",
    );
    assert.match(server, /import "server-only"/);
    assert.match(server, /runExactProjectThreadFetch/);
    assert.doesNotMatch(barrel, /runExactProjectThreadFetch/);
    assert.doesNotMatch(barrel, /from "\.\/exact-thread"/);
    assert.doesNotMatch(barrel, /from "\.\/server"/);
    assert.match(exact, /coerceGmailThreadId\(pointer\.gmailThreadId\)/);
    assert.doesNotMatch(exact, /input\.threadId/);
    assert.doesNotMatch(exact, /listMessages\(/);
    assert.match(exact, /messages\.list-forbidden-on-exact-thread-path/);
    assert.doesNotMatch(exact, /correctProjectSpec|applyProjectSpecCorrection/);
    assert.doesNotMatch(evidence, /correctProjectSpec|applyProjectSpecCorrection/);
    assert.match(evidence, /automaticApply: false/);
    assert.doesNotMatch(payload, /\/messages\/[^?\s"'`]+\/attachments\//);
    assert.doesNotMatch(actions, /runExactProjectThreadFetch/);
    assert.doesNotMatch(historyActions, /runExactProjectThreadFetch/);
    const achedekalActions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/achedekal-review-actions.ts"),
      "utf8",
    );
    const achedekalPage = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/project-reconstruction/achedekal/page.tsx",
      ),
      "utf8",
    );
    assert.match(achedekalActions, /"use server"/);
    assert.match(achedekalActions, /getAuthenticatedGmailConnectionStore/);
    assert.match(achedekalActions, /executeAchedekalEvidenceReview/);
    assert.match(achedekalActions, /ACHEDEKAL_PROJECT_ID/);
    assert.doesNotMatch(achedekalActions, /formData\.get\(/);
    assert.doesNotMatch(achedekalPage, /runExactProjectThreadFetch|getThread\(/);
    assert.doesNotMatch(exact, /putCheckpoint|tryClaimHistoricalChunk|indexMessage/);
    assert.doesNotMatch(exact, /insertObservation|continuum_observations/);
  });

  it("keeps jewelry-aware reconstruction evidence-only with no related-thread fetch", () => {
    const reconstruction = readFileSync(
      join(GMAIL_DIR, "project-reconstruction.ts"),
      "utf8",
    );
    const cad = readFileSync(join(GMAIL_DIR, "cad-job-identifier.ts"), "utf8");
    const fixture = readFileSync(join(GMAIL_DIR, "alea-chedekal-fixture.ts"), "utf8");
    const barrel = readFileSync(join(GMAIL_DIR, "index.ts"), "utf8");
    const server = readFileSync(join(GMAIL_DIR, "server.ts"), "utf8");
    const containment = readFileSync(
      join(GMAIL_DIR, "project-book-containment.ts"),
      "utf8",
    );
    const discovery = readFileSync(
      join(GMAIL_DIR, "achedekal-candidate-discovery.ts"),
      "utf8",
    );
    for (const source of [reconstruction, cad, fixture, containment, discovery]) {
      assert.doesNotMatch(source, /correctProjectSpec|applyProjectSpecCorrection/);
      assert.doesNotMatch(source, /editPersonProfile|createPersonAtomic/);
      assert.doesNotMatch(source, /runExactProjectThreadFetch|listMessages\(/);
      assert.doesNotMatch(source, /gmail\.googleapis|users\.messages\.send/);
      assert.doesNotMatch(source, /\/messages\/[^?\s"'`]+\/attachments\//);
      assert.match(source, /automaticApply: false|does not write/i);
    }
    assert.doesNotMatch(barrel, /from "\.\/project-reconstruction"/);
    assert.doesNotMatch(server, /from "\.\/project-reconstruction"/);
    assert.doesNotMatch(barrel, /from "\.\/alea-chedekal-fixture"/);
    assert.doesNotMatch(server, /reconstructProjectBook/);
    assert.doesNotMatch(barrel, /from "\.\/project-book-containment"/);
    assert.doesNotMatch(server, /from "\.\/project-book-containment"/);
    assert.doesNotMatch(server, /routeProjectEvidence/);
    assert.doesNotMatch(barrel, /from "\.\/achedekal-candidate-discovery"/);
    assert.doesNotMatch(server, /from "\.\/achedekal-candidate-discovery"/);
    assert.doesNotMatch(discovery, /createLiveGmailApi|users\.threads\.get/);
  });

  it("keeps founder-reviewed reconstruction proposals evidence-only and fetch-free", () => {
    const proposal = readFileSync(
      join(GMAIL_DIR, "reconstruction-proposal.ts"),
      "utf8",
    );
    const observation = readFileSync(
      join(GMAIL_DIR, "artifact-observation.ts"),
      "utf8",
    );
    const ui = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/components/achedekal-reconstruction-proposal.tsx",
      ),
      "utf8",
    );
    const barrel = readFileSync(join(GMAIL_DIR, "index.ts"), "utf8");
    const server = readFileSync(join(GMAIL_DIR, "server.ts"), "utf8");
    for (const source of [proposal, observation, ui]) {
      assert.doesNotMatch(source, /correctProjectSpec|applyProjectSpecCorrection/);
      assert.doesNotMatch(source, /editPersonProfile|createPersonAtomic/);
      assert.doesNotMatch(source, /runExactProjectThreadFetch|listMessages\(/);
      assert.doesNotMatch(source, /getAttachment|getThread\(|getMessage\(/);
      assert.doesNotMatch(source, /gmail\.googleapis|users\.messages\.send/);
      assert.doesNotMatch(source, /\/messages\/[^?\s"'`]+\/attachments\//);
      assert.match(source, /automaticApply: false|does not write/i);
    }
    assert.match(proposal, /automaticApply: false/);
    assert.match(proposal, /proposedCanonicalWrites: \[\]/);
    assert.doesNotMatch(barrel, /from "\.\/reconstruction-proposal"/);
    assert.doesNotMatch(server, /from "\.\/reconstruction-proposal"/);
    assert.doesNotMatch(barrel, /from "\.\/artifact-observation"/);
    assert.doesNotMatch(server, /from "\.\/artifact-observation"/);
    assert.doesNotMatch(ui, /executeAchedekalKnownArtifactPreview|getAttachment/);
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
    assert.match(actions, /testGmailConnection/);
    assert.doesNotMatch(actions, /GOOGLE_REFRESH_TOKEN/);
    assert.doesNotMatch(actions, /runHistoricalSync/);
    assert.doesNotMatch(actions, /formData\.get\(/);
  });

  it("keeps the founder history chunk runner private, one-page, and count-only", () => {
    const history = readFileSync(join(GMAIL_DIR, "history.ts"), "utf8");
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail-history-actions.ts"),
      "utf8",
    );
    const ui = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/components/gmail-history.tsx"),
      "utf8",
    );
    const page = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail/page.tsx"),
      "utf8",
    );
    assert.match(history, /GMAIL_HISTORY_CHUNK_MAX_PAGES = 1/);
    assert.match(history, /runHistoricalSync/);
    assert.match(actions, /"use server"/);
    assert.match(actions, /runGmailHistoryChunk/);
    assert.doesNotMatch(actions, /formData\.get\(/);
    assert.doesNotMatch(actions, /runHistoricalSync/);
    assert.match(page, /GmailHistoryForm/);
    assert.match(ui, /Start backfill/);
    assert.match(ui, /Finish backfill/);
    assert.match(ui, /Stop after current chunk/);
    assert.match(actions, /runNextGmailHistoryChunk/);
    assert.doesNotMatch(ui, /mailboxEmailHash|ciphertext|subject|snippet/);
    for (const file of walk(join(ROOT, "app/api"), ".ts")) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /runGmailHistoryChunk|runNextGmailHistoryChunk|runHistoricalSync/);
    }
  });

  it("keeps the founder Gmail connection test off public routes and mailbox content", () => {
    const probe = readFileSync(join(GMAIL_DIR, "connection-test.ts"), "utf8");
    const page = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail/page.tsx"),
      "utf8",
    );
    const ui = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/components/gmail-connection-test.tsx",
      ),
      "utf8",
    );
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail-actions.ts"),
      "utf8",
    );
    assert.match(probe, /GMAIL_CONNECTION_TEST_MAX_RESULTS = 5/);
    assert.match(probe, /\(in:inbox OR in:sent\) newer_than:7d/);
    assert.doesNotMatch(probe, /runHistoricalSync|indexMessage|putCheckpoint/);
    assert.doesNotMatch(probe, /\.getMessage\(|\.getThread\(/);
    assert.match(page, /GmailConnectionTestForm/);
    assert.match(ui, /Test connection/);
    assert.doesNotMatch(ui, /mailboxEmailHash|ciphertext|client_secret|CLIENT_ID/);
    assert.doesNotMatch(page, /mailboxEmailHash|ciphertext|emailAddress/);
    assert.match(actions, /readOnlyGmailConnectionStore/);
    for (const file of walk(join(ROOT, "app/api"), ".ts")) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /runGmailConnectionTest|testGmailConnection/);
    }
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
