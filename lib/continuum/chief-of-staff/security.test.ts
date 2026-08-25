import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const COS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(COS_DIR, "../../..");

function walkFiles(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

describe("Chief of Staff Phase 1B security / PII boundary", () => {
  it("keeps CoS modules free of LLM, Resend, Gmail, and browser storage", () => {
    for (const file of walkFiles(COS_DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /openai|anthropic|grok|generateText/i);
      assert.doesNotMatch(source, /from ["']resend["']/);
      assert.doesNotMatch(source, /gmail\.readonly|Gmail Memory/i);
      assert.doesNotMatch(source, /continuum_gmail_messages|continuum_gmail_checkpoints/);
      assert.doesNotMatch(source, /localStorage|sessionStorage|gtag/);
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /insertObservation|continuum_observations/);
      assert.doesNotMatch(source, /continuum_events|continuum_evidence/);
    }
  });

  it("keeps the Supabase store off the public barrel and behind server-only", () => {
    const barrel = readFileSync(join(COS_DIR, "index.ts"), "utf8");
    const server = readFileSync(join(COS_DIR, "persistence", "server.ts"), "utf8");
    assert.match(server, /import "server-only"/);
    assert.match(server, /createSupabaseChiefOfStaffStore/);
    assert.doesNotMatch(barrel, /createSupabaseChiefOfStaffStore/);
    assert.doesNotMatch(barrel, /from "\.\/persistence\/supabase"/);
    assert.doesNotMatch(barrel, /from "\.\/persistence\/server"/);
  });

  it("does not attach a public CoS API or client Supabase", () => {
    const apiFiles = walkFiles(join(ROOT, "app/api"), ".ts");
    assert.ok(apiFiles.length > 0);
    for (const file of apiFiles) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /chief-of-staff/);
      assert.doesNotMatch(source, /continuum_attention_/);
    }
  });

  it("does not switch production dashboard loader or morning email delivery", () => {
    const dashboard = readFileSync(
      join(ROOT, "lib/continuum/dashboard/compose.ts"),
      "utf8",
    );
    const server = readFileSync(
      join(ROOT, "lib/continuum/dashboard/server.ts"),
      "utf8",
    );
    const cadenceExecute = readFileSync(
      join(ROOT, "lib/agent-os/cadence-delivery/execute.ts"),
      "utf8",
    );
    const cadenceRender = readFileSync(
      join(ROOT, "lib/agent-os/cadence-delivery/render-email.ts"),
      "utf8",
    );
    for (const source of [dashboard, server, cadenceExecute, cadenceRender]) {
      assert.doesNotMatch(source, /continuum\/chief-of-staff/);
      assert.doesNotMatch(source, /renderMorningEmail/);
      assert.doesNotMatch(source, /composeChiefOfStaffBrief/);
    }
    assert.match(dashboard, /status: "quiet"/);
  });

  it("leaves the PII-free kernel schema without attention tables", () => {
    const kernel = readFileSync(
      join(ROOT, "lib/supabase/continuum-schema.sql"),
      "utf8",
    );
    assert.doesNotMatch(kernel, /continuum_attention_items/);
    assert.doesNotMatch(kernel, /continuum_attention_briefs/);
    assert.match(kernel, /Never stores customer name, email, phone, message/);
  });
});
