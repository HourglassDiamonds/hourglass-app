/**
 * Stored-field evidence synthesis regressions.
 * Indexed metadata only. Does not fetch Gmail or attachment bytes.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  COHORT_SYNTHESIS_PROJECT_A,
  COHORT_SYNTHESIS_PROJECT_A_ID,
  COHORT_SYNTHESIS_PROJECT_B,
  COHORT_SYNTHESIS_PROJECT_B_ID,
  COHORT_SYNTHESIS_PROJECT_C,
  COHORT_SYNTHESIS_PROJECT_C_ID,
  COHORT_SYNTHESIS_PROJECT_D,
  COHORT_SYNTHESIS_PROJECT_D_ID,
  COHORT_SYNTHESIS_PROJECT_E,
  COHORT_SYNTHESIS_PROJECT_E_ID,
} from "./cohort-evidence-synthesis-fixtures";
import { presentIndexedProjectReconstructionProposal } from "./reconstruction-proposal";
import {
  assessStoredFingerSizeEvidence,
  assessStoredOrderEvidence,
  collectProjectScopedRecoveredSnippets,
  extractStoredOrderIdentifiers,
} from "./reconstruction-evidence-support";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function snippet(input: {
  projectId: string;
  text: string;
  sourceType?:
    | "exact_stored_thread_subject"
    | "candidate_thread_subject"
    | "project_attributed_artifact_filename"
    | "project_attributed_artifact_subject";
  threadId?: string;
  filename?: string;
}) {
  return {
    sourceType: input.sourceType ?? "exact_stored_thread_subject",
    text: input.text,
    projectId: input.projectId,
    threadId: input.threadId ?? "thread-1",
    messageId: "msg-1",
    filename: input.filename ?? null,
  };
}

function orderOf(
  projectId: string,
  storedOrder: string,
  recovered: Parameters<typeof assessStoredOrderEvidence>[0]["recovered"],
  storedCad?: string,
) {
  return assessStoredOrderEvidence({
    targetProjectId: projectId,
    storedOrder,
    storedCad,
    recovered,
  });
}

describe("stored order identifier extraction", () => {
  it("extracts a single strong stored order without flattening", () => {
    assert.deepEqual(extractStoredOrderIdentifiers("SP13040"), ["SP13040"]);
    assert.deepEqual(extractStoredOrderIdentifiers("140"), []);
    assert.deepEqual(extractStoredOrderIdentifiers("69"), []);
  });

  it("keeps malformed multi-value stored orders as distinct identifiers", () => {
    assert.deepEqual(extractStoredOrderIdentifiers("SP12318 / SP12882"), [
      "SP12318",
      "SP12882",
    ]);
  });
});

describe("Project A live-shape acceptance", () => {
  it("treats SP13040 as supported by the exact Project-related thread subject", () => {
    const recovered = collectProjectScopedRecoveredSnippets({
      targetProjectId: COHORT_SYNTHESIS_PROJECT_A_ID,
      storedThreadSubjects: [
        {
          threadId: COHORT_SYNTHESIS_PROJECT_A.storedThreadId,
          subject: COHORT_SYNTHESIS_PROJECT_A.recoveredSubject,
        },
      ],
    });
    const assessment = orderOf(
      COHORT_SYNTHESIS_PROJECT_A_ID,
      COHORT_SYNTHESIS_PROJECT_A.order,
      recovered,
      COHORT_SYNTHESIS_PROJECT_A.cad,
    );
    assert.equal(assessment?.state, "supported");
    assert.deepEqual(assessment?.supportedStoredIdentifiers, ["SP13040"]);
    assert.deepEqual(assessment?.additionalRecoveredIdentifiers, []);
    assert.equal(assessment?.canonical, false);
    assert.equal(assessment?.automaticApply, false);
    assert.match(assessment?.reviewNote ?? "", /Supported by recovered indexed evidence/i);
    assert.match(assessment?.reviewNote ?? "", /not canonical/i);
    assert.equal(
      assessment?.supportingEvidence.some(
        (row) =>
          row.sourceType === "exact_stored_thread_subject" &&
          row.identifier === "SP13040",
      ),
      true,
    );
  });

  it("keeps SP12943 as an additional order identifier and does not retype RN tokens as orders", () => {
    const recovered = collectProjectScopedRecoveredSnippets({
      targetProjectId: COHORT_SYNTHESIS_PROJECT_A_ID,
      storedThreadSubjects: [
        {
          threadId: COHORT_SYNTHESIS_PROJECT_A.storedThreadId,
          subject:
            "RE: HGD - Chicken ring (his)-C010657-SP13040 SP12943 RN04163 RN05883",
        },
      ],
    });
    const assessment = orderOf(
      COHORT_SYNTHESIS_PROJECT_A_ID,
      COHORT_SYNTHESIS_PROJECT_A.order,
      recovered,
      COHORT_SYNTHESIS_PROJECT_A.cad,
    );
    assert.equal(assessment?.state, "conflicting");
    assert.deepEqual(assessment?.storedIdentifiers, ["SP13040"]);
    assert.deepEqual(assessment?.supportedStoredIdentifiers, ["SP13040"]);
    assert.deepEqual(assessment?.additionalRecoveredIdentifiers, ["SP12943"]);
    assert.equal(assessment?.additionalRecoveredIdentifiers.includes("RN04163"), false);
    assert.equal(assessment?.additionalRecoveredIdentifiers.includes("RN05883"), false);
    assert.equal(assessment?.additionalRecoveredIdentifiers.includes("C010657"), false);
    assert.equal(assessment?.canonical, false);
    assert.equal(assessment?.automaticApply, false);
    assert.match(assessment?.reviewNote ?? "", /Additional recovered order identifier: SP12943/i);
    assert.match(
      assessment?.reviewNote ?? "",
      /not interpreted as order identifiers/i,
    );
    assert.doesNotMatch(assessment?.reviewNote ?? "", /RN04163|RN05883/);
  });

  it("admits a typed Order-context identifier that is not the stored SP family", () => {
    const assessment = orderOf(
      COHORT_SYNTHESIS_PROJECT_A_ID,
      COHORT_SYNTHESIS_PROJECT_A.order,
      [
        snippet({
          projectId: COHORT_SYNTHESIS_PROJECT_A_ID,
          text: "RE: HGD - Chicken ring (his)-C010657-SP13040 Order: AB-555",
        }),
      ],
      COHORT_SYNTHESIS_PROJECT_A.cad,
    );
    assert.equal(assessment?.supportedStoredIdentifiers.includes("SP13040"), true);
    assert.deepEqual(assessment?.additionalRecoveredIdentifiers, ["AB-555"]);
    assert.equal(assessment?.state, "conflicting");
  });
});

describe("Project B live-shape conflict handling", () => {
  it("supports both stored identifiers, surfaces SP6934, and does not choose a winner", () => {
    const recovered = collectProjectScopedRecoveredSnippets({
      targetProjectId: COHORT_SYNTHESIS_PROJECT_B_ID,
      candidateThreadSubjects: [
        {
          threadId: "thread-b-sp6934",
          subject: COHORT_SYNTHESIS_PROJECT_B.recoveredSubjects[0]!,
          attributedProjectId: COHORT_SYNTHESIS_PROJECT_B_ID,
        },
        {
          threadId: "thread-b-sp12882",
          subject: COHORT_SYNTHESIS_PROJECT_B.recoveredSubjects[1]!,
          attributedProjectId: COHORT_SYNTHESIS_PROJECT_B_ID,
        },
      ],
      artifactMetadata: [
        {
          filename: COHORT_SYNTHESIS_PROJECT_B.recoveredArtifact,
          subject: null,
          threadId: "thread-b-artifact",
          attributedProjectId: COHORT_SYNTHESIS_PROJECT_B_ID,
        },
      ],
    });
    const assessment = orderOf(
      COHORT_SYNTHESIS_PROJECT_B_ID,
      COHORT_SYNTHESIS_PROJECT_B.order,
      recovered,
      COHORT_SYNTHESIS_PROJECT_B.cad,
    );
    assert.equal(assessment?.state, "conflicting");
    assert.deepEqual(assessment?.storedIdentifiers, ["SP12318", "SP12882"]);
    assert.equal(assessment?.supportedStoredIdentifiers.includes("SP12318"), true);
    assert.equal(assessment?.supportedStoredIdentifiers.includes("SP12882"), true);
    assert.deepEqual(assessment?.additionalRecoveredIdentifiers, ["SP6934"]);
    assert.equal(assessment?.canonical, false);
    assert.equal(assessment?.automaticApply, false);
    assert.match(assessment?.reviewNote ?? "", /No automatic correction/i);
    assert.doesNotMatch(assessment?.reviewNote ?? "", /final order|the winner|automatically corrected/i);
  });
});

describe("Project C live-shape unlinked acceptance", () => {
  it("supports SP12883 from Project-scoped subject and artifact with no Person link", () => {
    const recovered = collectProjectScopedRecoveredSnippets({
      targetProjectId: COHORT_SYNTHESIS_PROJECT_C_ID,
      storedThreadSubjects: [
        {
          threadId: COHORT_SYNTHESIS_PROJECT_C.storedThreadId,
          subject: COHORT_SYNTHESIS_PROJECT_C.recoveredSubject,
        },
      ],
      artifactMetadata: [
        {
          filename: COHORT_SYNTHESIS_PROJECT_C.recoveredArtifact,
          subject: null,
          attributedProjectId: COHORT_SYNTHESIS_PROJECT_C_ID,
        },
      ],
    });
    const assessment = orderOf(
      COHORT_SYNTHESIS_PROJECT_C_ID,
      COHORT_SYNTHESIS_PROJECT_C.order,
      recovered,
      COHORT_SYNTHESIS_PROJECT_C.cad,
    );
    assert.equal(assessment?.state, "supported");
    assert.deepEqual(assessment?.supportedStoredIdentifiers, ["SP12883"]);
    assert.match(
      assessment?.reviewNote ?? "",
      /thread subject and Project-attributed artifact/i,
    );
    const proposal = presentIndexedProjectReconstructionProposal({
      projectId: COHORT_SYNTHESIS_PROJECT_C_ID,
      currentStored: {
        fingerSize: COHORT_SYNTHESIS_PROJECT_C.fingerSize,
        orderNumber: COHORT_SYNTHESIS_PROJECT_C.order,
        cadJobNumber: COHORT_SYNTHESIS_PROJECT_C.cad,
        metal: null,
        centerStone: null,
      },
      existingPerson: null,
      indexedMessages: [],
      storedThreadId: COHORT_SYNTHESIS_PROJECT_C.storedThreadId,
      recoveredProjectMetadata: recovered,
    });
    const order = proposal.conflictingStoredData.find(
      (row) => row.field === "order_number",
    );
    assert.equal(order?.status, "supported");
    assert.equal(proposal.automaticApply, false);
    assert.deepEqual(proposal.proposedCanonicalWrites, []);
    assert.equal(proposal.sold, false);
  });
});

describe("Projects D/E sparse preservation", () => {
  it("does not support D or E from stored identifiers or sibling Project evidence", () => {
    const d = orderOf(COHORT_SYNTHESIS_PROJECT_D_ID, COHORT_SYNTHESIS_PROJECT_D.order, [], COHORT_SYNTHESIS_PROJECT_D.cad);
    const e = orderOf(COHORT_SYNTHESIS_PROJECT_E_ID, COHORT_SYNTHESIS_PROJECT_E.order, [], COHORT_SYNTHESIS_PROJECT_E.cad);
    assert.equal(d?.state, "unsupported");
    assert.equal(e?.state, "unsupported");
    const siblingLeak = orderOf(
      COHORT_SYNTHESIS_PROJECT_D_ID,
      COHORT_SYNTHESIS_PROJECT_D.order,
      [
        snippet({
          projectId: COHORT_SYNTHESIS_PROJECT_E_ID,
          text: `RE: HGD - MR-STUART-${COHORT_SYNTHESIS_PROJECT_E.cad}-${COHORT_SYNTHESIS_PROJECT_E.order}`,
        }),
        snippet({
          projectId: COHORT_SYNTHESIS_PROJECT_D_ID,
          text: `RE: HGD - sibling leak ${COHORT_SYNTHESIS_PROJECT_E.order}`,
          sourceType: "candidate_thread_subject",
        }),
      ],
      COHORT_SYNTHESIS_PROJECT_D.cad,
    );
    assert.equal(siblingLeak?.state, "unsupported");
    assert.equal(siblingLeak?.supportedStoredIdentifiers.length, 0);
  });
});

describe("cross-project support isolation", () => {
  it("does not let Project B evidence support Project A's stored order", () => {
    const recovered = collectProjectScopedRecoveredSnippets({
      targetProjectId: COHORT_SYNTHESIS_PROJECT_A_ID,
      candidateThreadSubjects: [
        {
          threadId: "thread-b-with-a-order",
          subject: `RE: HGD - Henry-C015067-${COHORT_SYNTHESIS_PROJECT_A.order}`,
          attributedProjectId: COHORT_SYNTHESIS_PROJECT_B_ID,
        },
      ],
    });
    const assessment = orderOf(
      COHORT_SYNTHESIS_PROJECT_A_ID,
      COHORT_SYNTHESIS_PROJECT_A.order,
      recovered,
      COHORT_SYNTHESIS_PROJECT_A.cad,
    );
    assert.equal(assessment?.state, "unsupported");
    assert.equal(assessment?.supportingEvidence.length, 0);
  });

  it("rejects a foreign candidate thread even if stamped with the target Project id", () => {
    const assessment = orderOf(
      COHORT_SYNTHESIS_PROJECT_A_ID,
      COHORT_SYNTHESIS_PROJECT_A.order,
      [
        snippet({
          projectId: COHORT_SYNTHESIS_PROJECT_A_ID,
          text: `RE: HGD - Henry-C015067-${COHORT_SYNTHESIS_PROJECT_A.order}`,
          sourceType: "candidate_thread_subject",
        }),
      ],
      COHORT_SYNTHESIS_PROJECT_A.cad,
    );
    assert.equal(assessment?.state, "unsupported");
    assert.equal(assessment?.supportingEvidence.length, 0);
  });
});

describe("finger-size and weak identifier safety", () => {
  it("does not treat generic CAD/order numbers as finger-size support", () => {
    const a = assessStoredFingerSizeEvidence({
      targetProjectId: COHORT_SYNTHESIS_PROJECT_A_ID,
      storedFingerSize: COHORT_SYNTHESIS_PROJECT_A.fingerSize,
      itemTypeCandidate: "unknown",
      recovered: [
        snippet({
          projectId: COHORT_SYNTHESIS_PROJECT_A_ID,
          text: COHORT_SYNTHESIS_PROJECT_A.recoveredSubject,
        }),
      ],
    });
    const b = assessStoredFingerSizeEvidence({
      targetProjectId: COHORT_SYNTHESIS_PROJECT_B_ID,
      storedFingerSize: COHORT_SYNTHESIS_PROJECT_B.fingerSize,
      itemTypeCandidate: "unknown",
      recovered: [
        snippet({
          projectId: COHORT_SYNTHESIS_PROJECT_B_ID,
          text: COHORT_SYNTHESIS_PROJECT_B.recoveredSubjects[0]!,
        }),
      ],
    });
    const c = assessStoredFingerSizeEvidence({
      targetProjectId: COHORT_SYNTHESIS_PROJECT_C_ID,
      storedFingerSize: COHORT_SYNTHESIS_PROJECT_C.fingerSize,
      itemTypeCandidate: "unknown",
      recovered: [
        snippet({
          projectId: COHORT_SYNTHESIS_PROJECT_C_ID,
          text: COHORT_SYNTHESIS_PROJECT_C.recoveredSubject,
        }),
      ],
    });
    const d = assessStoredFingerSizeEvidence({
      targetProjectId: COHORT_SYNTHESIS_PROJECT_D_ID,
      storedFingerSize: COHORT_SYNTHESIS_PROJECT_D.fingerSize,
      itemTypeCandidate: "unknown",
      recovered: [],
    });
    const e = assessStoredFingerSizeEvidence({
      targetProjectId: COHORT_SYNTHESIS_PROJECT_E_ID,
      storedFingerSize: COHORT_SYNTHESIS_PROJECT_E.fingerSize,
      itemTypeCandidate: "unknown",
      recovered: [],
    });
    assert.equal(a?.state, "unsupported");
    assert.match(a?.reviewNote ?? "", /Plausible stored value/i);
    assert.equal(b?.state, "unsupported");
    assert.match(b?.reviewNote ?? "", /Suspicious stored value/i);
    assert.equal(c?.state, "unsupported");
    assert.match(c?.reviewNote ?? "", /Plausible stored value/i);
    assert.equal(d?.state, "unsupported");
    assert.equal(e?.state, "unsupported");
  });

  it("does not promote weak numeric values into support identifiers", () => {
    const assessment = orderOf(
      COHORT_SYNTHESIS_PROJECT_B_ID,
      "69",
      [
        snippet({
          projectId: COHORT_SYNTHESIS_PROJECT_B_ID,
          text: "Invoice 69 follow-up 70 140 212",
        }),
      ],
    );
    assert.equal(assessment?.state, "unsupported");
    assert.deepEqual(assessment?.storedIdentifiers, []);
    assert.deepEqual(assessment?.additionalRecoveredIdentifiers, []);
  });
});

describe("item-type safety and mutation boundary", () => {
  it("does not set item type to ring because a subject contains ring", () => {
    const proposal = presentIndexedProjectReconstructionProposal({
      projectId: COHORT_SYNTHESIS_PROJECT_A_ID,
      currentStored: {
        fingerSize: COHORT_SYNTHESIS_PROJECT_A.fingerSize,
        orderNumber: COHORT_SYNTHESIS_PROJECT_A.order,
        cadJobNumber: COHORT_SYNTHESIS_PROJECT_A.cad,
        metal: null,
        centerStone: null,
      },
      existingPerson: null,
      indexedMessages: [],
      storedThreadId: COHORT_SYNTHESIS_PROJECT_A.storedThreadId,
      recoveredProjectMetadata: [
        snippet({
          projectId: COHORT_SYNTHESIS_PROJECT_A_ID,
          text: COHORT_SYNTHESIS_PROJECT_A.recoveredSubject,
        }),
      ],
    });
    assert.equal(proposal.itemTypeCandidate, "unknown");
    assert.equal(proposal.itemTypeFromTextOnly, "unknown");
    assert.equal(proposal.sold, false);
    assert.equal(proposal.completed, false);
    assert.equal(proposal.automaticApply, false);
    assert.deepEqual(proposal.proposedCanonicalWrites, []);
    const order = proposal.conflictingStoredData.find(
      (row) => row.field === "order_number",
    );
    assert.equal(order?.status, "supported");
    assert.equal(order?.corrected, false);
    assert.equal(order?.canonical, false);
  });
});

describe("deduplication and privacy", () => {
  it("dedupes repeated subjects and filenames into one provenance row per source", () => {
    const assessment = orderOf(
      COHORT_SYNTHESIS_PROJECT_A_ID,
      COHORT_SYNTHESIS_PROJECT_A.order,
      [
        snippet({
          projectId: COHORT_SYNTHESIS_PROJECT_A_ID,
          text: COHORT_SYNTHESIS_PROJECT_A.recoveredSubject,
          threadId: "same-thread",
        }),
        snippet({
          projectId: COHORT_SYNTHESIS_PROJECT_A_ID,
          text: COHORT_SYNTHESIS_PROJECT_A.recoveredSubject,
          threadId: "same-thread",
        }),
      ],
      COHORT_SYNTHESIS_PROJECT_A.cad,
    );
    assert.equal(assessment?.state, "supported");
    assert.equal(assessment?.supportingEvidence.length, 1);
  });

  it("keeps the synthesis module fetch-free and mutation-free", () => {
    const source = readFileSync(
      join(ROOT, "lib/continuum/gmail/reconstruction-evidence-support.ts"),
      "utf8",
    );
    assert.match(source, /automaticApply: false/);
    assert.doesNotMatch(source, /getAttachment|getThread\(|getMessage\(|listMessages\(/);
    assert.doesNotMatch(source, /gmail\.googleapis|users\.messages|users\.threads/);
    assert.doesNotMatch(source, /correctProjectSpec|correctProjectKind|createOpenJob|writeHumanIntake/);
    assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
  });
});
