import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SourceNote } from "@/lib/continuum/client-memory/types";
import { sterlingFounderDirectiveNote } from "./founder-directive";
import {
  AUTHORIZED_SUPERVISED_TRIAL_NOTE_IDS,
  AUTHORIZED_SUPERVISED_TRIAL_STRUCTURED_DIRECTIVES,
  matchAuthorizedSupervisedTrialInputReadback,
} from "./authorized-supervised-trial-inputs-2026-11-20";

const JACKIE = "2483ad06-6858-4e1f-8545-2bc88f2b431a";
const NATALIE = "d1c0fc35-070e-41ee-b20f-7803a906e444";

const plainText = new Map([
  [JACKIE, "Founder confirmation — November 20, 2026. Jackie: I approved the quote for both ring resizings. Both resizings were completed and both rings were delivered back to Jackie. Close the quote, resizing, and return obligations; take Jackie off Waiting. This confirmation remains bound to reviewed Gmail thread 1a1474ed83440aa0 because no canonical Jackie Person or Project is established."],
  [NATALIE, "Founder confirmation — November 20, 2026. Natalie — C027055: the pear is the step cut, the shop CAD question is resolved, and the step-pear invoice is paid. Close those three items. Preserve Jewelers Mutual claim and paperwork as a separate workstream tied to reviewed Gmail thread 1a1c73a560b06ed3; do not use this note to close the insurance paperwork. This C027055 confirmation remains bound to reviewed Gmail thread 1a1a324788df8460 because no canonical Natalie Person or Project is established."],
]);

function note(noteId: string): SourceNote {
  const directive = AUTHORIZED_SUPERVISED_TRIAL_STRUCTURED_DIRECTIVES.get(noteId);
  const gmailThreadId = noteId === JACKIE
    ? "1a1474ed83440aa0"
    : noteId === NATALIE ? "1a1a324788df8460" : null;
  return {
    id: noteId,
    personId: directive?.personId ?? null,
    projectId: directive?.projectId ?? null,
    contextLayer: "client",
    sourceSystem: "concierge-manual",
    sourceArtifact: "concierge-manual",
    sourceSheet: "manual-notes",
    sourceField: "note",
    importRowKey: `manual:${directive?.directiveId ?? noteId}`,
    gmailThreadId,
    noteText: directive ? sterlingFounderDirectiveNote(directive) : plainText.get(noteId)!,
    createdAt: "2026-11-20T22:17:29.891726Z",
    lifecycleStatus: "kept",
    updatedAt: "2026-11-20T22:17:29.891726Z",
    updatedBy: "founder:justin-smith",
    deletedAt: null,
    previousLifecycle: null,
  };
}

describe("five-note supervised trial preflight", () => {
  it("accepts three exact directives and two exact kept source-bound notes", () => {
    const matched = matchAuthorizedSupervisedTrialInputReadback(
      AUTHORIZED_SUPERVISED_TRIAL_NOTE_IDS.map(note),
    );
    assert.ok(matched);
    assert.equal(matched.length, 5);
    assert.equal(matched.filter((row) => row.kind === "structured_directive").length, 3);
    assert.equal(matched.filter((row) => row.kind === "kept_plain_note").length, 2);
    assert.equal(matched.every((row) => row.checksumVerified), true);
  });

  it("fails closed on plain-note checksum or source drift", () => {
    const checksumDrift = AUTHORIZED_SUPERVISED_TRIAL_NOTE_IDS.map(note);
    checksumDrift.find((row) => row.id === JACKIE)!.noteText += " changed";
    assert.equal(matchAuthorizedSupervisedTrialInputReadback(checksumDrift), null);

    const sourceDrift = AUTHORIZED_SUPERVISED_TRIAL_NOTE_IDS.map(note);
    sourceDrift.find((row) => row.id === NATALIE)!.gmailThreadId = "1a1474ed83440aa0";
    assert.equal(matchAuthorizedSupervisedTrialInputReadback(sourceDrift), null);
  });

  it("fails closed on structured-directive or lifecycle drift", () => {
    const directiveDrift = AUTHORIZED_SUPERVISED_TRIAL_NOTE_IDS.map(note);
    const sarah = directiveDrift.find((row) => row.id === "4314cae8-a87c-4972-b675-978652a9cc69")!;
    sarah.noteText = sarah.noteText.replace("November 25–27", "November 24");
    assert.equal(matchAuthorizedSupervisedTrialInputReadback(directiveDrift), null);

    const lifecycleDrift = AUTHORIZED_SUPERVISED_TRIAL_NOTE_IDS.map(note);
    lifecycleDrift.find((row) => row.id === JACKIE)!.lifecycleStatus = "trashed";
    assert.equal(matchAuthorizedSupervisedTrialInputReadback(lifecycleDrift), null);
  });
});
