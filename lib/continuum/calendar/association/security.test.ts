import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, "../../../..");
const CALENDAR_DIR = resolve(DIR, "..");

function walk(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

describe("Calendar association security", () => {
  it("does not mint People, merge, create Open Jobs, or change Kind/lifecycle", () => {
    for (const file of walk(DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /createPersonAtomic|insertPersonProfile|editPersonProfile/);
      assert.doesNotMatch(source, /createProjectJob|insertProjectJob|saveOpenJob/);
      assert.doesNotMatch(source, /setProjectLifecycle|correctProjectSpec|correctProjectKind/);
      assert.doesNotMatch(source, /continuum_open_jobs/);
      assert.doesNotMatch(source, /from\("continuum_human_source_links"\)/);
      assert.doesNotMatch(source, /users\.events\.insert|calendar\.events/);
      assert.doesNotMatch(source, /auth\/calendar"/);
      assert.doesNotMatch(source, /OPENAI|ANTHROPIC|GOOGLE_API_KEY/);
    }
  });

  it("does not attach association ingest to public API routes or broaden OAuth", () => {
    const apiFiles = walk(join(ROOT, "app/api"), ".ts");
    assert.ok(apiFiles.length > 0);
    for (const file of apiFiles) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /proposeCalendarAssociationCandidates|ingestCalendarAssociationCandidates/);
      assert.doesNotMatch(source, /reviewCalendarAssociationCandidate/);
    }
    const oauth = readFileSync(join(CALENDAR_DIR, "oauth.ts"), "utf8");
    assert.match(oauth, /CALENDAR_READONLY_SCOPE/);
    assert.doesNotMatch(oauth, /auth\/calendar"/);
    assert.match(oauth, /include_granted_scopes: "false"/);
  });

  it("keeps the association writer server-only and off the Calendar barrel", () => {
    const server = readFileSync(join(DIR, "server.ts"), "utf8");
    const barrel = readFileSync(join(DIR, "index.ts"), "utf8");
    const calendarBarrel = readFileSync(join(CALENDAR_DIR, "index.ts"), "utf8");
    assert.match(server, /import "server-only"/);
    assert.doesNotMatch(barrel, /createSupabaseCalendarAssociationWriter/);
    assert.doesNotMatch(barrel, /from "\.\/supabase"/);
    assert.doesNotMatch(barrel, /from "\.\/server"/);
    assert.doesNotMatch(calendarBarrel, /createSupabaseCalendarAssociationWriter/);
  });

  it("surfaces Calendar Candidates on the shared founder review, not a parallel inbox", () => {
    const page = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/calendar/page.tsx"),
      "utf8",
    );
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/intake-review-actions.ts"),
      "utf8",
    );
    assert.match(page, /IntakeCandidateReviewList/);
    assert.match(page, /ingestCalendarAssociationCandidates/);
    assert.match(page, /Association review/);
    assert.doesNotMatch(page, /calendar-candidate-inbox|CalendarCandidateInbox/);
    assert.match(actions, /reviewCalendarAssociationCandidate/);
    assert.match(actions, /reviewHumanIntakeCandidate/);
    assert.match(actions, /sourceSystem === "google_calendar"/);
    assert.doesNotMatch(actions, /InMemoryCandidateStore/);
    assert.doesNotMatch(actions, /createBrowserClient/);
  });
});
