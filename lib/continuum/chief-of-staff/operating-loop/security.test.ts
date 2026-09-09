import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, "../../../..");

function walkFiles(dir: string, suffix: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found;
}

const INFERENCE_FILES = [
  "collect.ts",
  "compose.ts",
  "evidence.ts",
  "present.ts",
  "rank.ts",
  "reconcile.ts",
  "propose-actions.ts",
  "founder-attention.ts",
  "moderator.ts",
  "attribution.ts",
  "load.ts",
  "types.ts",
  "fixtures.ts",
];

describe("CoS operating loop security", () => {
  it("does not create a second task store or duplicate Open Jobs table", () => {
    for (const file of walkFiles(DIR, ".ts")) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /create table/i);
      assert.doesNotMatch(source, /continuum_cos_tasks|continuum_top5|continuum_commitments/);
      assert.doesNotMatch(source, /createProjectJob/);
      assert.doesNotMatch(source, /applyReview|reviewStatus:\s*"approved"/);
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /openai|anthropic|generateText/i);
      assert.doesNotMatch(source, /gmail\.googleapis|createBrowserClient/);
    }
  });

  it("keeps inference free of canonical writes", () => {
    for (const name of INFERENCE_FILES) {
      const source = readFileSync(join(DIR, name), "utf8");
      assert.doesNotMatch(source, /mutateJob|mutateOpenJob|completeFounderActionable/);
      assert.doesNotMatch(source, /setProjectLifecycle|correctProjectKind|mergePerson|mintPerson/);
      assert.doesNotMatch(source, /composeChiefOfStaffBrief|runChiefOfStaffShadow/);
    }
    const complete = readFileSync(join(DIR, "complete.ts"), "utf8");
    assert.match(complete, /action: "resolve"/);
    assert.match(complete, /writer\.mutateJob/);
    assert.match(complete, /unsupported-writer/);
    assert.doesNotMatch(complete, /applyReview/);
  });

  it("keeps Command Center writes on a dedicated founder action", () => {
    const action = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/cos-operating-loop-actions.ts"),
      "utf8",
    );
    const shared = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/actions.ts"),
      "utf8",
    );
    const page = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/page.tsx"),
      "utf8",
    );
    assert.match(action, /getAuthenticatedProjectJobWriter/);
    assert.match(action, /completeFounderActionable/);
    assert.doesNotMatch(action, /applyReview|setProjectLifecycle|gmail\.googleapis/);
    assert.doesNotMatch(action, /reviewIntakeCandidateAction|createProjectJob/);
    assert.doesNotMatch(shared, /completeTop5OpenJobAction|completeFounderActionable/);
    assert.match(page, /loadCosOperatingLoop/);
    assert.match(page, /completeTop5OpenJobAction/);
    assert.doesNotMatch(page, /composeChiefOfStaffBrief|runChiefOfStaffShadow/);
    const proposedUi = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/components/cos-proposed-actions.tsx"),
      "utf8",
    );
    assert.match(proposedUi, /Add to actions/);
    assert.doesNotMatch(proposedUi, /createProjectJob|mutateJob|applyReview/);
    const today = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/components/chief-of-staff-today.tsx"),
      "utf8",
    );
    assert.match(today, /item\.job\.editHref/);
    assert.match(today, /CosFounderAttentionControls/);
    assert.match(today, /composeTodayDocket/);
    assert.match(today, /CosBriefActions/);
    assert.match(today, /CosWatchingList/);
    assert.doesNotMatch(today, /COS_PROPOSED_ACTIONS_TITLE|Proposed actions/);
    assert.match(page, /reviewProposedActionFromForm/);
    assert.doesNotMatch(page, /composeChiefOfStaffBrief|runChiefOfStaffShadow/);
    for (const file of walkFiles(join(ROOT, "app/api"), ".ts")) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /operating-loop|completeTop5OpenJobAction/);
    }
  });
});
