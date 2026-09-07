import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { assessCalendarOAuthProductionReadiness } from "./oauth-readiness";
import { CALENDAR_READONLY_SCOPE } from "./types";

const CALENDAR_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(CALENDAR_DIR, "../../..");

function walk(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

describe("Calendar activation security", () => {
  it("keeps the Supabase adapter server-only", () => {
    const server = readFileSync(join(CALENDAR_DIR, "server.ts"), "utf8");
    const barrel = readFileSync(join(CALENDAR_DIR, "index.ts"), "utf8");
    assert.match(server, /import "server-only"/);
    assert.match(server, /createSupabaseCalendarConnectionStore/);
    assert.doesNotMatch(barrel, /createSupabaseCalendarConnectionStore/);
    assert.doesNotMatch(barrel, /from "\.\/supabase"/);
    assert.doesNotMatch(barrel, /from "\.\/server"/);
  });

  it("does not log secrets, descriptions, or canonical writes", () => {
    for (const file of walk(CALENDAR_DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      const executable = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      assert.doesNotMatch(executable, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(executable, /createPersonAtomic|insertSourceNote|insertWish/);
      assert.doesNotMatch(executable, /continuum_open_jobs|saveOpenJob/);
      assert.doesNotMatch(executable, /setProjectLifecycle|correctProjectSpec/);
      assert.doesNotMatch(executable, /GOOGLE_REFRESH_TOKEN|CONTINUUM_GMAIL_TOKEN_KEK/);
      assert.doesNotMatch(executable, /NEXT_PUBLIC_CONTINUUM_CALENDAR/);
      assert.doesNotMatch(executable, /getContinuumGmailOAuthClientSecret/);
      assert.doesNotMatch(executable, /liveGmailAccessTokenRefresher/);
    }
  });

  it("does not attach Calendar reads to public API routes besides OAuth", () => {
    const apiFiles = walk(join(ROOT, "app/api"), ".ts");
    assert.ok(apiFiles.length > 0);
    for (const file of apiFiles) {
      const source = readFileSync(file, "utf8");
      const normalized = file.replace(/\\/g, "/");
      if (normalized.includes("/api/continuum/calendar/oauth/")) {
        assert.match(source, /force-dynamic/);
        assert.doesNotMatch(source, /refresh_token|access_token|auth-code/);
        assert.doesNotMatch(source, /summary|description|attendees/);
        continue;
      }
      assert.doesNotMatch(source, /createLiveCalendarApi|readCalendarContext/);
      assert.doesNotMatch(source, /continuum_calendar_connections/);
    }
  });

  it("keeps OAuth routes founder-gated and off token rendering", () => {
    const start = readFileSync(
      join(ROOT, "app/api/continuum/calendar/oauth/start/route.ts"),
      "utf8",
    );
    const callback = readFileSync(
      join(ROOT, "app/api/continuum/calendar/oauth/callback/route.ts"),
      "utf8",
    );
    const gated = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/calendar/oauth/start/route.ts",
      ),
      "utf8",
    );
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/calendar-actions.ts"),
      "utf8",
    );
    assert.match(start, /handleCalendarOAuthStart/);
    assert.match(callback, /handleCalendarOAuthCallback/);
    assert.match(gated, /requireInternalClientMemorySession/);
    assert.match(actions, /"use server"/);
    assert.doesNotMatch(actions, /formData\.get\(/);
    assert.doesNotMatch(actions, /GOOGLE_REFRESH_TOKEN/);
  });

  it("documents calendar.readonly only and does not request Gmail scopes", () => {
    const types = readFileSync(join(CALENDAR_DIR, "types.ts"), "utf8");
    const oauth = readFileSync(join(CALENDAR_DIR, "oauth.ts"), "utf8");
    assert.match(types, /https:\/\/www\.googleapis\.com\/auth\/calendar\.readonly/);
    assert.match(oauth, /CALENDAR_READONLY_SCOPE/);
    assert.doesNotMatch(oauth, /gmail\.readonly|gmail\.modify|mail\.google\.com/);
    assert.match(oauth, /include_granted_scopes: "false"/);
    assert.equal(
      CALENDAR_READONLY_SCOPE,
      "https://www.googleapis.com/auth/calendar.readonly",
    );
  });

  it("keeps the founder Calendar surface private and description-free", () => {
    const page = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/calendar/page.tsx"),
      "utf8",
    );
    const ui = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/components/calendar-context.tsx",
      ),
      "utf8",
    );
    const home = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/components/command-center-home.tsx",
      ),
      "utf8",
    );
    assert.match(page, /robots: \{ index: false/);
    assert.match(page, /force-dynamic/);
    assert.match(page, /Calendar consent required|CalendarConnectionControls/);
    assert.match(ui, /Coming up/);
    assert.match(ui, /Recently/);
    assert.doesNotMatch(ui, /this belongs to|prep for|follow up after/i);
    assert.doesNotMatch(ui, /description/);
    assert.doesNotMatch(page, /OpenProjectsHome|Current Projects/);
    assert.match(home, /CONCIERGE_CALENDAR_PATH/);
    assert.doesNotMatch(home, /data-open-projects-home[\s\S]*Calendar/);
  });

  it("does not print founder email or secrets in the readiness assessment", () => {
    const report = assessCalendarOAuthProductionReadiness();
    const serialized = JSON.stringify(report);
    assert.equal(serialized.includes("@"), false);
    assert.doesNotMatch(serialized, /CLIENT_SECRET|TOKEN_KEK|refresh-token|founder@/i);
    assert.equal(report.mixedWithGmailOauth, false);
    assert.equal(
      report.configurationGate,
      "CODE READY — CALENDAR CONSENT REQUIRED",
    );
  });

  it("does not register a Calendar cron", () => {
    const vercel = readFileSync(join(ROOT, "vercel.json"), "utf8");
    assert.doesNotMatch(vercel, /calendar/i);
  });
});
