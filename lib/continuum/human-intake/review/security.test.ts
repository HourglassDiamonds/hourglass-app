import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, "../../../..");

describe("Human intake review security", () => {
  it("applies only through existing writers and never mints Persons or kernel rows", () => {
    const apply = readFileSync(join(DIR, "apply.ts"), "utf8");
    assert.match(apply, /applyFounderReview/);
    assert.match(apply, /HUMAN_INTAKE_APPROVE_WRITE_ORDER/);
    assert.match(apply, /writer-committed-review-unpersisted/);
    assert.match(apply, /addManualNote/);
    assert.match(apply, /createProjectJob/);
    assert.match(apply, /correctProjectSpec/);
    assert.doesNotMatch(apply, /insertPersonProfile|createPersonAtomic/);
    assert.doesNotMatch(apply, /insertEvent|insertEvidence|insertObservation/);
    assert.doesNotMatch(apply, /openai|anthropic|generateText/i);
    assert.doesNotMatch(apply, /continuum_commitments/);
    assert.doesNotMatch(apply, /setProjectLifecycle|correctProjectKind/);
  });

  it("keeps Open Job writes off the shared Concierge actions module", () => {
    const shared = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/actions.ts"),
      "utf8",
    );
    assert.doesNotMatch(shared, /createProjectJob|saveOpenJob|mutateOpenJob|continuum_project_jobs/);
    const dedicated = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/intake-review-actions.ts"),
      "utf8",
    );
    assert.match(dedicated, /reviewHumanIntakeCandidate/);
    assert.match(dedicated, /getAuthenticatedProjectJobWriter/);
    assert.match(dedicated, /getAuthenticatedCandidateStore/);
    assert.doesNotMatch(dedicated, /InMemoryCandidateStore/);
    assert.doesNotMatch(dedicated, /createBrowserClient/);
    assert.doesNotMatch(dedicated, /node:crypto/);
  });
});
