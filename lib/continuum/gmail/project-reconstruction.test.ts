import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { aleaChedekalReconstructionInput } from "./alea-chedekal-fixture";
import { extractCadJobIdentifiers } from "./cad-job-identifier";
import type { ProtectedExactThread } from "./exact-thread-payload";
import {
  assessIdentityNameBoundary,
  classifyItemState,
  classifyJewelryItemTypes,
  classifySizeEvidence,
  RECONSTRUCTION_MUTATION_BOUNDARY,
  reconstructProjectBook,
} from "./project-reconstruction";
import {
  ADJACENCY_THREAD,
  ACHEDEKAL_THREAD,
} from "./exact-thread-fixtures";
import { protectExactThread } from "./exact-thread-payload";
import {
  buildExactThreadReconstructionHandoff,
  collectExactThreadEvidence,
} from "./reconstruction-evidence";

const DIR = dirname(fileURLToPath(import.meta.url));

function threadFrom(text: string, subject = "Project note"): ProtectedExactThread {
  return {
    threadId: "19syntheticthread0001",
    messages: [
      {
        messageId: "msg-synthetic-1",
        internalDate: "2024-06-01T12:00:00.000Z",
        direction: "outbound",
        from: "founder@hourglass.example",
        to: ["client@example.com"],
        cc: [],
        bcc: [],
        subject,
        plainText: text,
        mimeParts: [],
        attachments: [],
      },
    ],
  };
}

function reconstructText(text: string, extras?: { subject?: string; lifecycle?: "historical_closed" | "active_open" | "unknown" }) {
  return reconstructProjectBook({
    projectId: "proj-synthetic",
    currentSpecs: {
      fingerSize: null,
      orderNumber: null,
      cadJobNumber: null,
      metal: null,
      centerStone: null,
    },
    currentLifecycle: extras?.lifecycle ?? "unknown",
    existingPerson: {
      personId: "22222222-2222-4222-8222-222222222222",
      displayName: "Ada Client",
      emailHash: "a".repeat(64),
    },
    sourceNameEvidence: [],
    thread: threadFrom(text, extras?.subject),
    indexedMessages: [],
  });
}

describe("jewelry-type-aware project reconstruction", () => {
  it("maps ring size only to ring/finger context", () => {
    const handoff = reconstructText("Ring size 6.5 for the platinum band.");
    const ring = handoff.items.find((item) => item.itemType === "ring");
    assert.ok(ring);
    assert.equal(ring.sizeType === "finger_size" || ring.sizeType === "ring_size", true);
    assert.deepEqual(
      ring.sizes.map((row) => row.proposedValue),
      ["6.5"],
    );
    assert.equal(
      ring.sizes.every((row) => row.sizeType === "finger_size" || row.sizeType === "ring_size"),
      true,
    );
    assert.equal(
      classifyJewelryItemTypes("Ring size 6.5 for the platinum band.").includes("ring"),
      true,
    );
  });

  it("does not map bracelet size to finger_size", () => {
    const handoff = reconstructText(
      "Wrist size 6.5 inches for the bracelet.",
    );
    const bracelet = handoff.items.find((item) => item.itemType === "bracelet");
    assert.ok(bracelet);
    assert.equal(
      bracelet.sizes.some((row) => row.sizeType === "finger_size"),
      false,
    );
    assert.equal(
      bracelet.sizes.some(
        (row) => row.sizeType === "wrist_size" || row.sizeType === "bracelet_length",
      ),
      true,
    );
    assert.equal(handoff.items.some((item) => item.itemType === "ring"), false);
  });

  it("does not map necklace length to finger_size", () => {
    const handoff = reconstructText("Necklace length 18 inches.");
    const necklace = handoff.items.find((item) => item.itemType === "necklace");
    assert.ok(necklace);
    assert.equal(
      necklace.sizes.some((row) => row.sizeType === "finger_size"),
      false,
    );
    assert.equal(
      necklace.sizes.some(
        (row) =>
          row.sizeType === "necklace_length" || row.sizeType === "chain_length",
      ),
      true,
    );
    assert.equal(
      classifySizeEvidence("Necklace length 18 inches.", "necklace").some(
        (row) => row.sizeType === "finger_size",
      ),
      false,
    );
  });

  it("gives loose stones no default jewelry size", () => {
    const handoff = reconstructText(
      "Two loose marquise champagne-colored stones purchased.",
    );
    const stones = handoff.items.find((item) => item.itemType === "loose_stones");
    assert.ok(stones);
    assert.equal(stones.sizeType, "none");
    assert.equal(stones.sizes.length, 0);
  });

  it("represents a multi-item project without collapsing types", () => {
    const handoff = reconstructText(
      "Two loose marquise stones purchased. We discussed a diamonds-by-the-yard bracelet.",
    );
    assert.equal(handoff.projectShape, "multi_item");
    const types = handoff.items.map((item) => item.itemType).sort();
    assert.deepEqual(types, ["bracelet", "loose_stones"]);
  });

  it("separates completed items from contemplated items", () => {
    const handoff = reconstructProjectBook(aleaChedekalReconstructionInput());
    const stones = handoff.items.find((item) => item.itemType === "loose_stones");
    const bracelet = handoff.items.find((item) => item.itemType === "bracelet");
    assert.ok(stones);
    assert.ok(bracelet);
    assert.equal(stones.state, "completed_sold");
    assert.equal(stones.owned, true);
    assert.equal(bracelet.state, "discussed_contemplated");
    assert.equal(bracelet.owned, false);
    assert.equal(
      handoff.items.some(
        (item) => item.itemType === "bracelet" && item.state === "completed_sold",
      ),
      false,
    );
  });

  it("does not treat a contemplated item as owned or completed", () => {
    assert.equal(classifyItemState("We discussed a bracelet"), "discussed_contemplated");
    const handoff = reconstructText("We discussed a bracelet.");
    const bracelet = handoff.items.find((item) => item.itemType === "bracelet");
    assert.ok(bracelet);
    assert.equal(bracelet.state, "discussed_contemplated");
    assert.equal(bracelet.owned, false);
  });

  it("keeps a historical project historical when evidence is rediscovered", () => {
    const handoff = reconstructProjectBook(aleaChedekalReconstructionInput());
    assert.equal(handoff.lifecycle, "historical_closed");
    assert.equal(handoff.historicalSafety.remainsHistorical, true);
    assert.equal(handoff.historicalSafety.lifecycleMutated, false);
    assert.equal(handoff.historicalSafety.createsOperationalWork, false);
  });

  it("does not create Open Jobs from rediscovered history", () => {
    const handoff = reconstructProjectBook(aleaChedekalReconstructionInput());
    assert.deepEqual(handoff.openJobs, []);
    assert.equal(handoff.historicalSafety.createsOpenJobs, false);
    assert.equal(handoff.mutationBoundary.createsOpenJobs, false);
    assert.deepEqual(handoff.operationalWork, []);
  });

  it("rejects CAD presentation as a job identifier and accepts a valid code", () => {
    assert.deepEqual(extractCadJobIdentifiers("CAD presentation"), []);
    assert.deepEqual(extractCadJobIdentifiers("Please see CAD-8821."), ["CAD-8821"]);
    const handoff = reconstructProjectBook(aleaChedekalReconstructionInput());
    const cadValues = handoff.items.flatMap((item) =>
      item.cadJobNumbers.map((row) => row.proposedValue),
    );
    assert.equal(cadValues.includes("presentation"), false);
    assert.equal(cadValues.includes("CAD-8821"), true);
  });

  it("keeps ambiguous bracelet sizing distinct from explicit length", () => {
    const ambiguous = classifySizeEvidence(
      "bracelet around 6.5 or 7 inches",
      "bracelet",
    );
    assert.equal(
      ambiguous.some((row) => row.confidence === "ambiguous"),
      true,
    );
    assert.equal(
      ambiguous.every((row) => row.sizeType !== "finger_size"),
      true,
    );
    const explicit = classifySizeEvidence(
      "final bracelet length 6.75 inches",
      "bracelet",
    );
    assert.equal(explicit.length > 0, true);
    assert.equal(explicit[0]?.sizeType, "bracelet_length");
    assert.equal(explicit[0]?.confidence, "strong");
    assert.equal(explicit[0]?.value, "6.75");

    const handoff = reconstructProjectBook(aleaChedekalReconstructionInput());
    const bracelet = handoff.items.find((item) => item.itemType === "bracelet");
    assert.ok(bracelet);
    assert.equal(
      bracelet.sizes.some(
        (row) => row.confidence === "ambiguous" && row.sizeType !== "finger_size",
      ),
      true,
    );
    assert.equal(
      bracelet.sizes.some(
        (row) =>
          row.proposedValue === "6.75" &&
          row.sizeType === "bracelet_length" &&
          row.confidence === "strong",
      ),
      true,
    );
    assert.equal(
      bracelet.sizes.every((row) => row.sourceWording.length > 0),
      true,
    );
  });

  it("does not create a duplicate Person from source name variation", () => {
    const input = aleaChedekalReconstructionInput();
    const handoff = reconstructProjectBook(input);
    assert.equal(handoff.identity.duplicatePersonCreated, false);
    assert.equal(handoff.identity.automaticRename, false);
    assert.equal(handoff.identity.fuzzyMerge, false);
    assert.equal(handoff.identity.personId, input.existingPerson?.personId);
    assert.equal(handoff.identity.nameCorrectionEvidence.length > 0, true);
    assert.equal(
      handoff.identity.nameCorrectionEvidence[0]?.kind,
      "possible_identity_name_correction",
    );
    assert.equal(
      handoff.identity.nameCorrectionEvidence[0]?.observedDisplayName,
      "Alea Chedekal",
    );
    assert.equal(
      handoff.identity.nameCorrectionEvidence[0]?.automaticRename,
      false,
    );
    assert.equal(
      handoff.identity.nameCorrectionEvidence[0]?.correctionPath,
      "intentional-person-correction",
    );

    const nameOnly = assessIdentityNameBoundary({
      existingPerson: input.existingPerson,
      sourceNameEvidence: [
        {
          sourceSystem: "notes",
          displayName: "Someone Else Entirely",
          emailHash: null,
        },
      ],
    });
    assert.equal(nameOnly.duplicatePersonCreated, false);
    assert.equal(nameOnly.neverMergeNameOnly, true);
    assert.equal(nameOnly.automaticRename, false);
  });

  it("does not propose canonical writes", () => {
    const handoff = reconstructProjectBook(aleaChedekalReconstructionInput());
    assert.deepEqual(handoff.proposedCanonicalWrites, []);
    assert.equal(handoff.automaticApply, false);
    assert.deepEqual(handoff.mutationBoundary, RECONSTRUCTION_MUTATION_BOUNDARY);
    for (const flag of Object.values(handoff.mutationBoundary)) {
      assert.equal(flag, false);
    }
  });

  it("prepares related-thread discovery without fetching", () => {
    const handoff = reconstructProjectBook(aleaChedekalReconstructionInput());
    assert.equal(handoff.relatedThreads.autoFetch, false);
    assert.equal(handoff.relatedThreads.mailboxWideBodySearch, false);
    assert.equal(handoff.relatedThreads.requiresFounderApprovalToFetch, true);
    assert.equal(
      handoff.relatedThreads.candidates.every((row) => row.fetchApproved === false),
      true,
    );
    assert.equal(
      handoff.relatedThreads.candidates.some((row) => row.threadId === "19relatedcad8821aaaa"),
      true,
    );
    assert.equal(
      handoff.relatedThreads.candidates.some((row) => row.threadId === "19unrelatedhello0001"),
      false,
    );
    assert.equal(
      handoff.relatedThreads.identifiers.some((row) => row.kind === "cad_job_number"),
      true,
    );
    assert.equal(
      handoff.relatedThreads.identifiers.some((row) => row.kind === "anchor_thread"),
      true,
    );
    const cadCandidate = handoff.relatedThreads.candidates.find(
      (row) => row.threadId === "19relatedcad8821aaaa",
    );
    assert.ok(cadCandidate);
    assert.equal(typeof cadCandidate.score, "number");
    assert.equal(cadCandidate.score >= 100, true);
    assert.equal(cadCandidate.requiresFounderReview, true);
    assert.equal(cadCandidate.candidateProjectId, handoff.projectId);
    assert.equal(cadCandidate.reasons.length > 0, true);
    assert.equal(
      cadCandidate.reasons.some((row) => row.kind === "cad_identifier_strong"),
      true,
    );
    assert.deepEqual(cadCandidate.reasons, cadCandidate.matchedOn);
  });

  it("does not treat earrings as having a jewelry size by default", () => {
    const handoff = reconstructText("Stud earrings in platinum.");
    const earrings = handoff.items.find((item) => item.itemType === "earrings");
    assert.ok(earrings);
    assert.equal(earrings.sizeType, "none");
    assert.equal(earrings.sizes.length, 0);
  });
});

describe("Alea Chedekal synthetic acceptance fixture", () => {
  it("expresses completed stones, contemplated bracelet, and historical safety", () => {
    const handoff = reconstructProjectBook(aleaChedekalReconstructionInput());
    assert.equal(handoff.projectShape, "multi_item");
    const stones = handoff.items.find((item) => item.itemType === "loose_stones");
    const bracelet = handoff.items.find((item) => item.itemType === "bracelet");
    assert.ok(stones);
    assert.ok(bracelet);
    assert.equal(stones.state, "completed_sold");
    assert.equal(
      stones.stoneShape.some((row) => row.proposedValue === "marquise"),
      true,
    );
    assert.equal(
      stones.stoneColor.some((row) => row.proposedValue === "champagne"),
      true,
    );
    assert.equal(bracelet.state, "discussed_contemplated");
    assert.equal(bracelet.owned, false);
    assert.equal(
      bracelet.sizes.some((row) => row.sizeType === "finger_size"),
      false,
    );
    assert.equal(handoff.lifecycle, "historical_closed");
    assert.deepEqual(handoff.openJobs, []);
    assert.equal(handoff.mutationBoundary.updatesPersons, false);
    assert.equal(handoff.mutationBoundary.updatesProjectSpecs, false);
    assert.equal(handoff.mutationBoundary.fetchesRelatedThreads, false);
    assert.equal(handoff.mutationBoundary.fetchesAttachmentBytes, false);
  });
});

describe("exact-thread CAD identifier quality", () => {
  it("rejects CAD presentation on the exact-thread evidence collector", () => {
    const thread = protectExactThread(ADJACENCY_THREAD);
    const evidence = collectExactThreadEvidence(thread);
    assert.equal(
      evidence.some((row) => row.kind === "cad_job_number" && row.proposedValue === "141"),
      true,
    );
    const presentation = {
      ...thread,
      messages: thread.messages.map((row) => ({
        ...row,
        plainText: "CAD presentation for the design render revision update approval.",
        subject: "CAD presentation",
      })),
    };
    const rejected = collectExactThreadEvidence(presentation);
    assert.equal(
      rejected.some((row) => row.kind === "cad_job_number"),
      false,
    );
  });

  it("still surfaces explicit ring size on the Achedekal exact-thread fixture", () => {
    const handoff = buildExactThreadReconstructionHandoff({
      projectId: "proj-achedekal",
      currentSpecs: {
        fingerSize: "141",
        orderNumber: "140",
        cadJobNumber: "CAD-1",
        metal: "platinum",
        centerStone: null,
      },
      thread: protectExactThread(ACHEDEKAL_THREAD),
    });
    assert.equal(
      handoff.candidateEvidence.some(
        (row) => row.kind === "finger_size" && row.proposedValue === "6.5",
      ),
      true,
    );
  });
});

describe("reconstruction mutation source boundary", () => {
  it("does not import canonical writers, Gmail fetch, or CoS writes", () => {
    const source = readFileSync(join(DIR, "project-reconstruction.ts"), "utf8");
    const fixture = readFileSync(join(DIR, "alea-chedekal-fixture.ts"), "utf8");
    const cad = readFileSync(join(DIR, "cad-job-identifier.ts"), "utf8");
    const order = readFileSync(join(DIR, "order-identifier.ts"), "utf8");
    const specificity = readFileSync(join(DIR, "identifier-specificity.ts"), "utf8");
    for (const text of [source, fixture, cad, order, specificity]) {
      assert.doesNotMatch(text, /correctProjectSpec|applyProjectSpecCorrection/);
      assert.doesNotMatch(text, /editPersonProfile|createPersonAtomic|insertEntity\(/);
      assert.doesNotMatch(text, /runExactProjectThreadFetch|getThread\(|listMessages\(/);
      assert.doesNotMatch(text, /\/messages\/[^?\s"'`]+\/attachments\//);
      assert.doesNotMatch(text, /insertSourceNote|writeHumanIntake/);
      assert.doesNotMatch(text, /chief-of-staff|composeChiefOfStaff/);
      assert.doesNotMatch(text, /gmail\.googleapis|users\.messages\.send/);
      assert.doesNotMatch(text, /Apply button/);
    }
  });
});
