import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { requireInternalClientMemorySession } from "../read/access";

const JOBS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(JOBS_DIR, "../../../..");

function walkFiles(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

const WRITE_MARKERS = [
  /createProjectJob/,
  /mutateOpenJob/,
  /saveOpenJob/,
  /continuum_project_jobs/,
  /continuum_project_job_mutations/,
  /InMemoryProjectJobStore/,
];

describe("Open Jobs security", () => {
  it("does not log or use a browser Supabase client", () => {
    for (const file of walkFiles(JOBS_DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /createBrowserClient/);
      assert.doesNotMatch(source, /gmail\.googleapis/);
      assert.doesNotMatch(source, /openai|anthropic|generateText|chat\.completions/i);
    }
  });

  it("does not attach Open Job writes to public API or public Concierge", () => {
    const apiFiles = walkFiles(join(ROOT, "app/api"), ".ts");
    assert.ok(apiFiles.length > 0);
    for (const file of apiFiles) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /createProjectJob/);
      assert.doesNotMatch(source, /mutateOpenJob/);
      assert.doesNotMatch(source, /saveOpenJob/);
      assert.doesNotMatch(source, /continuum_project_jobs/);
      assert.doesNotMatch(source, /project-jobs/);
    }
    const publicConcierge = readFileSync(join(ROOT, "app/concierge/page.tsx"), "utf8");
    assert.doesNotMatch(publicConcierge, /project-jobs|createProjectJob|Open Jobs/);
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/actions.ts"),
      "utf8",
    );
    assert.doesNotMatch(actions, /createProjectJob|saveOpenJob|mutateOpenJob|continuum_project_jobs/);
  });

  it("does not create Open Jobs from Lifecycle, operating details, Gmail, Human Intake, or CoS", () => {
    const files = [
      join(ROOT, "lib/continuum/client-memory/project-lifecycle/set.ts"),
      join(ROOT, "lib/continuum/client-memory/project-operating/correct.ts"),
      join(ROOT, "lib/continuum/client-memory/apply.ts"),
      join(ROOT, "lib/continuum/client-memory/import-runtime.ts"),
      join(ROOT, "lib/continuum/client-memory/human-intake/ingest.ts"),
      join(ROOT, "lib/continuum/gmail/project-reconstruction.ts"),
      join(ROOT, "lib/continuum/gmail/reconstruction-proposal.ts"),
      join(ROOT, "lib/continuum/chief-of-staff/compose.ts"),
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const pattern of WRITE_MARKERS) {
        assert.doesNotMatch(source, pattern, file);
      }
    }
    const gmailDir = join(ROOT, "lib/continuum/gmail");
    for (const file of walkFiles(gmailDir, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /createProjectJob/);
      assert.doesNotMatch(source, /mutateOpenJob/);
      assert.doesNotMatch(source, /continuum_project_jobs/);
    }
  });

  it("fails closed without an internal founder session on Project Desk load", () => {
    const denied = requireInternalClientMemorySession(undefined);
    assert.equal(denied.ok, false);
    const load = readFileSync(
      join(ROOT, "lib/continuum/client-memory/project-desk/load.ts"),
      "utf8",
    );
    assert.match(load, /requireInternalClientMemorySession/);
    assert.doesNotMatch(load, /createProjectJob|saveOpenJob/);
  });

  it("keeps founder Open Job writes on a dedicated private action module", () => {
    const denied = requireInternalClientMemorySession(undefined);
    assert.equal(denied.ok, false);
    const writerLoad = readFileSync(join(JOBS_DIR, "load-writer.ts"), "utf8");
    assert.match(writerLoad, /requireInternalClientMemorySession/);
    assert.match(writerLoad, /unauthorized/);
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/project-jobs-actions.ts"),
      "utf8",
    );
    assert.match(actions, /getAuthenticatedProjectJobWriter/);
    assert.match(actions, /saveOpenJob/);
    assert.match(actions, /mutateOpenJobAction/);
    assert.doesNotMatch(actions, /gmail\.googleapis|continuum_gmail_messages/);
    assert.doesNotMatch(actions, /setProjectLifecycle|ingestHumanIntake|composeChiefOfStaffBrief/);
    const shared = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/actions.ts"),
      "utf8",
    );
    assert.doesNotMatch(shared, /saveOpenJob|mutateOpenJobAction|project-jobs-actions/);
    for (const relative of [
      "app/executive-dashboard/concierge/projects/[projectId]/jobs/new/page.tsx",
      "app/executive-dashboard/concierge/projects/[projectId]/jobs/[jobId]/page.tsx",
    ]) {
      const page = readFileSync(join(ROOT, relative), "utf8");
      assert.match(page, /robots: \{ index: false/);
      assert.match(page, /getAuthenticatedProjectJobWriter/);
      assert.doesNotMatch(page, /createBrowserClient/);
    }
  });
});
