import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { before, describe, it } from "node:test";

const require = createRequire(import.meta.url);
const nodeModule = require("module") as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = nodeModule._load;
nodeModule._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};

let selectTrustedProjectThreadAssociations:
  typeof import("./today-associations").selectTrustedProjectThreadAssociations;

before(async () => {
  ({ selectTrustedProjectThreadAssociations } = await import("./today-associations"));
});

const PROJECT_A = "17ef9d5b-39d2-48bf-85f6-93209a4c4e38";
const PROJECT_B = "27ef9d5b-39d2-48bf-85f6-93209a4c4e39";
const THREAD = "1a15fb0c9b520621";

function row(projectId: string, status = "trusted", threadId = THREAD) {
  return {
    project_id: projectId,
    source_type: "gmail",
    source_identity: threadId,
    source_thread_id: threadId,
    status,
  };
}

describe("trusted Project Gmail associations for Today", () => {
  it("returns no membership without a trusted association", () => {
    assert.deepEqual(
      [...selectTrustedProjectThreadAssociations([], new Set([PROJECT_A]))],
      [],
    );
    assert.deepEqual(
      [...selectTrustedProjectThreadAssociations([row(PROJECT_A, "candidate")], new Set([PROJECT_A]))],
      [],
    );
    assert.deepEqual(
      [...selectTrustedProjectThreadAssociations([row(PROJECT_A, "rejected")], new Set([PROJECT_A]))],
      [],
    );
  });

  it("keeps an exact trusted thread inside its canonical Project boundary", () => {
    assert.deepEqual(
      [...selectTrustedProjectThreadAssociations([row(PROJECT_A)], new Set([PROJECT_A, PROJECT_B]))],
      [[THREAD, PROJECT_A]],
    );
    assert.deepEqual(
      [...selectTrustedProjectThreadAssociations([row(PROJECT_A)], new Set([PROJECT_B]))],
      [],
    );
  });

  it("deduplicates replayed rows for one Project", () => {
    assert.deepEqual(
      [...selectTrustedProjectThreadAssociations([row(PROJECT_A), row(PROJECT_A)], new Set([PROJECT_A]))],
      [[THREAD, PROJECT_A]],
    );
  });

  it("fails closed when a thread has conflicting trusted ownership", () => {
    assert.deepEqual(
      [...selectTrustedProjectThreadAssociations(
        [row(PROJECT_A), row(PROJECT_B)],
        new Set([PROJECT_A, PROJECT_B]),
      )],
      [],
    );
  });

  it("rejects malformed, non-Gmail, and noncanonical source identities", () => {
    assert.deepEqual(
      [...selectTrustedProjectThreadAssociations([
        { ...row(PROJECT_A), source_type: "calendar" },
        row(PROJECT_A, "trusted", "not-a-provider-thread"),
      ], new Set([PROJECT_A]))],
      [],
    );
  });
});
