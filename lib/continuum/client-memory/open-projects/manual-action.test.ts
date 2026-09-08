import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { founderManualActionInput } from "./manual-action";

const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PERSON = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MUTATION = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("Founder manual action entry", () => {
  it("defaults ownership to founder and writes a required_action Open Job input", () => {
    const parsed = founderManualActionInput({
      mutationId: MUTATION,
      projectId: PROJECT,
      subject: "Call Travis about the shank",
      associatedPersonId: PERSON,
      dueAt: "2026-09-12T00:00:00.000Z",
      actor: "justin",
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.input.kind, "required_action");
    assert.equal(parsed.input.waitingOnActor, "founder");
    assert.equal(parsed.input.sourceSystem, "concierge-manual");
    assert.equal(parsed.input.associatedPersonId, PERSON);
    assert.equal(parsed.input.dueAt, "2026-09-12T00:00:00.000Z");
  });

  it("rejects lifecycle and waiting-state busywork as the action text", () => {
    for (const subject of [
      "IN PRODUCTION",
      "WAITING FOR CLIENT APPROVAL",
      "CAD / DESIGN",
      "WAITING ON CLIENT",
      "Current action not recorded",
    ]) {
      const parsed = founderManualActionInput({
        mutationId: MUTATION,
        projectId: PROJECT,
        subject,
        actor: "justin",
      });
      assert.equal(parsed.ok, false);
      if (!parsed.ok) assert.equal(parsed.code, "lifecycle-busywork");
    }
  });

  it("does not require a Person UUID when omitted", () => {
    const parsed = founderManualActionInput({
      mutationId: randomUUID(),
      projectId: PROJECT,
      subject: "Send the CAD revision",
      actor: "justin",
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.input.associatedPersonId, null);
  });
});
