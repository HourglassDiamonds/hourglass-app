import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CONTINUUM_FOUNDER_DISPLAY_NAME,
  composeContinuumHome,
  greetingLine,
  greetingPeriodFromDate,
} from "./compose";

const DASHBOARD_DIR = dirname(fileURLToPath(import.meta.url));

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, found);
    else if (/\.(ts|tsx)$/.test(entry.name)) found.push(path);
  }
  return found;
}

describe("Continuum command-center home composition", () => {
  it("greets Justin from a deterministic clock, never a login username", () => {
    const morning = composeContinuumHome({
      now: new Date("2026-08-24T12:00:00.000Z"),
    });
    const afternoon = composeContinuumHome({
      now: new Date("2026-08-24T18:00:00.000Z"),
    });
    const evening = composeContinuumHome({
      now: new Date("2026-08-24T22:00:00.000Z"),
    });
    assert.equal(morning.greeting.period, "morning");
    assert.equal(afternoon.greeting.period, "afternoon");
    assert.equal(evening.greeting.period, "evening");
    assert.equal(morning.greeting.displayName, "Justin");
    assert.equal(CONTINUUM_FOUNDER_DISPLAY_NAME, "Justin");
    assert.equal(greetingLine(morning), "Good morning, Justin.");
    assert.equal(greetingLine(afternoon), "Good afternoon, Justin.");
    assert.equal(greetingLine(evening), "Good evening, Justin.");
    assert.equal(greetingPeriodFromDate(new Date("2026-08-24T15:00:00.000Z")), "morning");
  });

  it("keeps Chief of Staff honestly quiet with zero items", () => {
    const model = composeContinuumHome({
      now: new Date("2026-08-24T18:00:00.000Z"),
    });
    assert.equal(model.chiefOfStaff.status, "quiet");
    assert.deepEqual(model.chiefOfStaff.items, []);
    assert.equal(model.chiefOfStaff.items.length, 0);
    assert.equal("id" in (model.chiefOfStaff.items[0] ?? {}), false);
  });

  it("does not import Agent OS, SLA, Client Memory writes, or auth/passkeys", () => {
    for (const file of walk(DASHBOARD_DIR)) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /agent-os/);
      assert.doesNotMatch(source, /chief-of-staff/);
      assert.doesNotMatch(source, /concierge\/sla/);
      assert.doesNotMatch(source, /client-attention/);
      assert.doesNotMatch(source, /getSupabaseAdmin|from\("continuum_/);
      assert.doesNotMatch(source, /passkeys|WebAuthn|EXECUTIVE_DASHBOARD_USERNAME/);
      assert.doesNotMatch(source, /reviewCount|recentPeople|birthday/);
      assert.doesNotMatch(source, /localStorage|sessionStorage|gtag/);
    }
  });

  it("keeps the App Router loader server-only and read-model-only", () => {
    const server = readFileSync(join(DASHBOARD_DIR, "server.ts"), "utf8");
    assert.match(server, /import "server-only"/);
    assert.match(server, /composeContinuumHome/);
    assert.doesNotMatch(server, /cookies\(|createSupabase|searchPeople/);
  });
});
