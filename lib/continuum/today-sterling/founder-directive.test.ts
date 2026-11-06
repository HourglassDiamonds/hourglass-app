import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClientMemoryNoteWriter } from "@/lib/continuum/client-memory/write/writer";
import {
  recordSterlingFounderDirective,
  sterlingFounderDirectiveNote,
  validateSterlingFounderDirective,
} from "./founder-directive";
import type { SterlingFounderDirectiveRecord } from "./types";

const DIRECTIVE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PERSON_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function directive(): SterlingFounderDirectiveRecord {
  return {
    directiveId: DIRECTIVE_ID,
    workUnitId: `project:${PROJECT_ID}`,
    projectId: PROJECT_ID,
    personId: PERSON_ID,
    sourceRefs: ["gmail:thread:1234567890ab:message:1234567890ac"],
    recordedAt: "2026-10-30T13:00:00.000Z",
    recordedBy: "founder:test",
    lifecycleStage: "cad",
    waitingOn: "client",
    attentionPriority: "monitor",
    relationshipRole: "client",
    disposition: "active",
    reason: "Founder confirmed CAD and an October 29 client wait.",
  };
}

describe("Sterling founder directive persistence", () => {
  it("requires exact canonical identity binding", () => {
    assert.ok(validateSterlingFounderDirective(directive()));
    assert.equal(validateSterlingFounderDirective({
      ...directive(),
      workUnitId: "project:dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    }), null);
  });

  it("uses the directive UUID as an idempotency key and retains an auditable payload", async () => {
    const writes = new Map<string, string>();
    const writer: Pick<ClientMemoryNoteWriter, "addManualNote"> = {
      async addManualNote(input) {
        const prior = writes.get(input.submissionId);
        if (prior && prior !== input.noteText) return { ok: false, reason: "idempotency-conflict" };
        writes.set(input.submissionId, input.noteText);
        return { ok: true, noteId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", status: prior ? "already-present" : "inserted" };
      },
    };
    const first = await recordSterlingFounderDirective({ writer, directive: directive() });
    const replay = await recordSterlingFounderDirective({ writer, directive: directive() });
    assert.deepEqual(first, { ok: true, noteId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", status: "inserted" });
    assert.deepEqual(replay, { ok: true, noteId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", status: "already-present" });
    assert.match(writes.get(DIRECTIVE_ID) ?? "", /Sterling founder directive v1/);
    assert.match(sterlingFounderDirectiveNote(directive()), /October 29 client wait/);
  });
});
