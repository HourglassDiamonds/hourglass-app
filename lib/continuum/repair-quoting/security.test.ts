import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";

const QUOTE_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(QUOTE_DIR, "../../..");

function walkFiles(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

const WRITE_MARKERS = [
  /createRepairQuote/,
  /issueRepairQuote/,
  /overrideRepairQuote/,
  /saveRepairQuote/,
  /continuum_repair_quotes/,
  /InMemoryRepairQuoteStore/,
];

describe("Repair quote security", () => {
  it("does not log or use a browser Supabase client", () => {
    for (const file of walkFiles(QUOTE_DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /createBrowserClient/);
      assert.doesNotMatch(source, /gmail\.googleapis/);
      assert.doesNotMatch(source, /openai|anthropic|generateText|chat\.completions/i);
    }
  });

  it("does not attach repair quoting to public API or public Concierge", () => {
    const apiFiles = walkFiles(join(ROOT, "app/api"), ".ts");
    assert.ok(apiFiles.length > 0);
    for (const file of apiFiles) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /createRepairQuote/);
      assert.doesNotMatch(source, /saveRepairQuote/);
      assert.doesNotMatch(source, /continuum_repair_quotes/);
      assert.doesNotMatch(source, /repair-quoting/);
    }
    const publicConcierge = readFileSync(join(ROOT, "app/concierge/page.tsx"), "utf8");
    assert.doesNotMatch(publicConcierge, /repair-quoting|createRepairQuote|Blue Book/);
    const publicApp = walkFiles(join(ROOT, "app"), ".tsx").filter(
      (file) => !file.includes(`${join("app", "executive-dashboard")}`),
    );
    for (const file of publicApp) {
      if (file.includes("node_modules")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /createRepairQuote|RepairQuoteForm|Blue Book quote/);
    }
  });

  it("does not create quotes from Lifecycle, operating details, Gmail, or CoS", () => {
    const files = [
      join(ROOT, "lib/continuum/client-memory/project-lifecycle/set.ts"),
      join(ROOT, "lib/continuum/client-memory/project-operating/correct.ts"),
      join(ROOT, "lib/continuum/client-memory/apply.ts"),
      join(ROOT, "lib/continuum/gmail/project-reconstruction.ts"),
      join(ROOT, "lib/continuum/chief-of-staff/compose.ts"),
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const pattern of WRITE_MARKERS) {
        assert.doesNotMatch(source, pattern, file);
      }
    }
  });

  it("fails closed without an internal founder session", () => {
    const denied = requireInternalClientMemorySession(undefined);
    assert.equal(denied.ok, false);
    const load = readFileSync(join(QUOTE_DIR, "load.ts"), "utf8");
    const writer = readFileSync(join(QUOTE_DIR, "load-writer.ts"), "utf8");
    assert.match(load, /requireInternalClientMemorySession/);
    assert.match(writer, /requireInternalClientMemorySession/);
    assert.match(writer, /createSupabaseRepairQuoteWriter/);
  });

  it("keeps founder quote writes on a dedicated private action module", () => {
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/repair-quote-actions.ts"),
      "utf8",
    );
    assert.match(actions, /"use server"/);
    assert.match(actions, /getAuthenticatedRepairQuoteWriter/);
    assert.doesNotMatch(actions, /createBrowserClient/);
    const shared = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/actions.ts"),
      "utf8",
    );
    assert.doesNotMatch(actions, /2850|UNVERIFIED_HISTORICAL_CONTEXT/);
    assert.doesNotMatch(shared, /createRepairQuote|saveRepairQuote|continuum_repair_quotes/);
  });
});
