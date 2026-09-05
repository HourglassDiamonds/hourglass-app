import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { requireInternalClientMemorySession } from "../read/access";

const ARTIFACTS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(ARTIFACTS_DIR, "../../../..");

function walkFiles(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

const WRITE_MARKERS = [
  /createProjectArtifact/,
  /saveProjectArtifact/,
  /continuum_project_artifacts/,
  /InMemoryProjectArtifactStore/,
];

describe("Project Artifacts security", () => {
  it("does not log, use a browser client, or expose public object URLs", () => {
    for (const file of walkFiles(ARTIFACTS_DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /createBrowserClient/);
      assert.doesNotMatch(source, /getPublicUrl/);
      assert.doesNotMatch(source, /gmail\.googleapis/);
      assert.doesNotMatch(source, /openai|anthropic|generateText|chat\.completions/i);
      assert.doesNotMatch(source, /shape-studio-captures|diamond-intelligence-submissions/);
      assert.doesNotMatch(source, /deleteArtifact|removeArtifact/);
    }
    const writer = readFileSync(join(ARTIFACTS_DIR, "writer.ts"), "utf8");
    assert.doesNotMatch(writer, /deleteArtifact|remove\(/);
    const supabaseWriter = readFileSync(join(ARTIFACTS_DIR, "supabase-writer.ts"), "utf8");
    assert.match(supabaseWriter, /upsert: false/);
    assert.doesNotMatch(supabaseWriter, /createSignedUrl|getPublicUrl/);
  });

  it("does not attach Project Artifact writes to public API or public Concierge", () => {
    const apiFiles = walkFiles(join(ROOT, "app/api"), ".ts");
    assert.ok(apiFiles.length > 0);
    for (const file of apiFiles) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /createProjectArtifact/);
      assert.doesNotMatch(source, /saveProjectArtifact/);
      assert.doesNotMatch(source, /continuum_project_artifacts/);
      assert.doesNotMatch(source, /project-artifacts/);
    }
    const publicConcierge = readFileSync(join(ROOT, "app/concierge/page.tsx"), "utf8");
    assert.doesNotMatch(publicConcierge, /project-artifacts|createProjectArtifact|Project files/);
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/actions.ts"),
      "utf8",
    );
    assert.doesNotMatch(
      actions,
      /createProjectArtifact|saveProjectArtifact|continuum_project_artifacts/,
    );
  });

  it("does not copy Gmail attachments or write Shape Studio, Human Intake, CoS, or Lifecycle", () => {
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
      assert.doesNotMatch(source, /createProjectArtifact/);
      assert.doesNotMatch(source, /continuum_project_artifacts/);
      assert.doesNotMatch(source, /continuum-project-artifacts/);
    }
    const create = readFileSync(join(ARTIFACTS_DIR, "create.ts"), "utf8");
    assert.match(create, /Does not copy Gmail attachments/);
    assert.doesNotMatch(create, /getAttachment|users\.messages/);
  });

  it("keeps founder Project Artifact writes on a dedicated private action module and file route", () => {
    const denied = requireInternalClientMemorySession(undefined);
    assert.equal(denied.ok, false);
    const writerLoad = readFileSync(join(ARTIFACTS_DIR, "load-writer.ts"), "utf8");
    assert.match(writerLoad, /requireInternalClientMemorySession/);
    assert.match(writerLoad, /unauthorized/);
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/project-artifacts-actions.ts"),
      "utf8",
    );
    assert.match(actions, /getAuthenticatedProjectArtifactWriter/);
    assert.match(actions, /saveProjectArtifact/);
    assert.doesNotMatch(actions, /gmail\.googleapis|continuum_gmail_messages|getAttachment/);
    assert.doesNotMatch(
      actions,
      /setProjectLifecycle|ingestHumanIntake|composeChiefOfStaffBrief/,
    );
    const shared = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/actions.ts"),
      "utf8",
    );
    assert.doesNotMatch(shared, /saveProjectArtifact|project-artifacts-actions/);
    const page = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/projects/[projectId]/artifacts/new/page.tsx",
      ),
      "utf8",
    );
    assert.match(page, /robots: \{ index: false/);
    assert.match(page, /getAuthenticatedProjectArtifactWriter/);
    assert.doesNotMatch(page, /createBrowserClient/);
    const route = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/projects/[projectId]/artifacts/[artifactId]/file/route.ts",
      ),
      "utf8",
    );
    assert.match(route, /getAuthenticatedProjectArtifactWriter/);
    assert.match(route, /Cache-Control": "private, no-store"/);
    assert.match(route, /X-Content-Type-Options": "nosniff"/);
    assert.match(route, /getArtifactBytes/);
    assert.doesNotMatch(route, /getPublicUrl|createSignedUrl/);
    assert.doesNotMatch(route, /gmail\.googleapis|getAttachment/);
  });
});
