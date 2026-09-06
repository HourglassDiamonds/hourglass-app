import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { requireInternalClientMemorySession } from "../read/access";

const COPY_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(COPY_DIR, "../../../..");

function walkFiles(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

describe("Gmail copy-in security", () => {
  it("keeps attachment fetch off incremental sync and the #16B GmailApi", () => {
    const incremental = readFileSync(
      join(ROOT, "lib/continuum/gmail/incremental-sync.ts"),
      "utf8",
    );
    const incrementalChunk = readFileSync(
      join(ROOT, "lib/continuum/gmail/incremental.ts"),
      "utf8",
    );
    const history = readFileSync(
      join(ROOT, "lib/continuum/gmail/history.ts"),
      "utf8",
    );
    const sync = readFileSync(join(ROOT, "lib/continuum/gmail/sync.ts"), "utf8");
    const adapter = readFileSync(
      join(ROOT, "lib/continuum/gmail/adapter.ts"),
      "utf8",
    );
    for (const source of [incremental, incrementalChunk, history, sync]) {
      assert.doesNotMatch(source, /copyGmailAttachmentToProject/);
      assert.doesNotMatch(source, /continuum_project_artifacts/);
      assert.doesNotMatch(source, /COPY_TO_PROJECT/);
      assert.doesNotMatch(source, /\/messages\/[^?\s"'`]+\/attachments\//);
    }
    assert.match(adapter, /export type GmailApi = \{/);
    assert.doesNotMatch(adapter, /getAttachment\(/);
    assert.match(adapter, /Do not call attachments\.get/);
    const copy = readFileSync(join(COPY_DIR, "copy.ts"), "utf8");
    assert.match(copy, /fetched only after explicit founder approval/);
    assert.match(copy, /createApi/);
    assert.match(copy, /getAttachment/);
    assert.doesNotMatch(copy, /users\.messages\.send|users\.messages\.modify|drafts\.|trash/);
  });

  it("does not attach copy-in to public API, public Concierge, or shared actions", () => {
    const apiFiles = walkFiles(join(ROOT, "app/api"), ".ts");
    assert.ok(apiFiles.length > 0);
    for (const file of apiFiles) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /copyGmailAttachmentToProject/);
      assert.doesNotMatch(source, /copyGmailProjectArtifact/);
      assert.doesNotMatch(source, /project-artifact-gmail-copy/);
    }
    const publicConcierge = readFileSync(join(ROOT, "app/concierge/page.tsx"), "utf8");
    assert.doesNotMatch(publicConcierge, /copyGmailProjectArtifact|COPY TO PROJECT/i);
    const shared = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/actions.ts"),
      "utf8",
    );
    assert.doesNotMatch(shared, /copyGmailProjectArtifact|project-artifact-gmail-copy-actions/);
    const denied = requireInternalClientMemorySession(undefined);
    assert.equal(denied.ok, false);
  });

  it("keeps founder copy-in private, session-gated, and off public object URLs", () => {
    for (const file of walkFiles(COPY_DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /createBrowserClient|getPublicUrl|createSignedUrl/);
      assert.doesNotMatch(source, /openai|anthropic|generateText|chat\.completions/i);
      assert.doesNotMatch(source, /users\.messages\.send|users\.messages\.modify/);
    }
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/project-artifact-gmail-copy-actions.ts"),
      "utf8",
    );
    assert.match(actions, /getAuthenticatedGmailArtifactCopy/);
    assert.match(actions, /copyGmailAttachmentToProject/);
    assert.match(actions, /createLiveKnownArtifactGmailApi/);
    assert.doesNotMatch(actions, /runGmailIncrementalChunk|runHistoricalSync|runIncrementalSync/);
    const page = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/projects/[projectId]/artifacts/copy-from-gmail/page.tsx",
      ),
      "utf8",
    );
    assert.match(page, /robots: \{ index: false/);
    assert.match(page, /getAuthenticatedGmailArtifactCopy/);
    const form = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/components/copy-gmail-attachment-to-project-form.tsx",
      ),
      "utf8",
    );
    assert.match(form, /name="approval"/);
    assert.match(form, /Copy to project/);
    assert.doesNotMatch(form, /getAttachment|gmail\.googleapis/);
  });

  it("does not let #14 manual create perform Gmail copy-in", () => {
    const create = readFileSync(
      join(ROOT, "lib/continuum/client-memory/project-artifacts/create.ts"),
      "utf8",
    );
    assert.match(create, /Does not copy Gmail attachments/);
    assert.doesNotMatch(create, /getAttachment|users\.messages/);
  });
});
