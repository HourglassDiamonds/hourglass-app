import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  ACHEDEKAL_KNOWN_ARTIFACT_CAD,
  ACHEDEKAL_KNOWN_ARTIFACT_FILENAME,
  ACHEDEKAL_PROJECT_ID,
} from "./achedekal-acceptance";
import {
  ALEA_KNOWN_THREAD_ID,
  aleaKnownThreadReconstructionInput,
} from "./alea-known-thread-fixture";
import {
  founderReviewedAchedekalArtifactObservation,
  observationOf,
} from "./artifact-observation";
import {
  reconstructProjectBook,
  RECONSTRUCTION_MUTATION_BOUNDARY,
} from "./project-reconstruction";
import {
  buildProjectReconstructionProposal,
  presentAchedekalReconstructionProposal,
  reconstructionProposalView,
  type FounderReportedContextItem,
} from "./reconstruction-proposal";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function textOnlyProposal() {
  const input = aleaKnownThreadReconstructionInput();
  const textReconstruction = reconstructProjectBook(input);
  return {
    input,
    textReconstruction,
    proposal: buildProjectReconstructionProposal({
      textReconstruction,
      currentStored: input.currentSpecs,
      artifactObservation: null,
    }),
  };
}

function artifactProposal(extra?: {
  founderReportedContext?: readonly FounderReportedContextItem[];
}) {
  const input = aleaKnownThreadReconstructionInput();
  const textReconstruction = reconstructProjectBook(input);
  return {
    input,
    textReconstruction,
    observation: founderReviewedAchedekalArtifactObservation(),
    proposal: buildProjectReconstructionProposal({
      textReconstruction,
      currentStored: input.currentSpecs,
      artifactObservation: founderReviewedAchedekalArtifactObservation(),
      founderReportedContext: extra?.founderReportedContext,
    }),
  };
}

function fact(
  proposal: ReturnType<typeof buildProjectReconstructionProposal>,
  field: string,
) {
  return proposal.supportedFacts.find((row) => row.field === field);
}

function sourceOf(file: string): string {
  return readFileSync(join(ROOT, file), "utf8");
}

const WRITER_PATTERN =
  /correctProjectSpec|applyProjectSpecCorrection|editPersonProfile|createPersonAtomic|insertProjectHistory|insertSourceNote|insertObservation|insertEvent|createOpenJob|writeHumanIntake|writeChiefOfStaff|today-5|chief-of-staff/;

const GMAIL_FETCH_PATTERN =
  /getAttachment|getThread\(|getMessage\(|listMessages\(|createLiveKnownArtifactGmailApi|executeAchedekalKnownArtifactPreview|runExactProjectThreadFetch|gmail\.googleapis|users\.messages/;

const VISION_PATTERN =
  /ocr|tesseract|openai|vision\.googleapis|image embeddings|computer vision|attachment scanner/i;

describe("artifact observation provenance", () => {
  it("binds every observation to the exact project, thread, artifact, and CAD", () => {
    const observation = founderReviewedAchedekalArtifactObservation();
    assert.equal(observation.artifactFilename, ACHEDEKAL_KNOWN_ARTIFACT_FILENAME);
    assert.equal(observation.sourceThreadId, ALEA_KNOWN_THREAD_ID);
    assert.equal(observation.sourceProjectId, ACHEDEKAL_PROJECT_ID);
    assert.equal(observation.cadIdentifier, ACHEDEKAL_KNOWN_ARTIFACT_CAD);
    assert.equal(observation.observationMethod, "founder_reviewed_visual");
    assert.equal(observation.founderReviewed, true);
    assert.equal(observation.canonical, false);
    assert.ok(observation.observations.length > 0);
    for (const row of observation.observations) {
      assert.equal(row.source, "artifact");
      assert.equal(row.sourceArtifact, ACHEDEKAL_KNOWN_ARTIFACT_FILENAME);
      assert.equal(row.sourceThreadId, ALEA_KNOWN_THREAD_ID);
      assert.equal(row.sourceProjectId, ACHEDEKAL_PROJECT_ID);
      assert.equal(row.cadIdentifier, ACHEDEKAL_KNOWN_ARTIFACT_CAD);
      assert.equal(row.founderReviewed, true);
      assert.equal(row.canonical, false);
    }
  });

  it("does not treat generic diamond-weight template headings as stone material", () => {
    const observation = founderReviewedAchedekalArtifactObservation();
    assert.equal(
      observation.observations.some((row) =>
        /champagne|sapphire|diamond|natural|lab|carat/i.test(row.observedValue),
      ),
      false,
    );
    assert.equal(
      observation.observations.some((row) => row.field.includes("material")),
      false,
    );
  });
});

describe("text-only vs founder-reviewed artifact reconstruction", () => {
  it("keeps text-only known-thread reconstruction itemType unknown", () => {
    const { proposal, textReconstruction } = textOnlyProposal();
    assert.equal(textReconstruction.items[0]?.itemType, "unknown");
    assert.equal(proposal.itemTypeFromTextOnly, "unknown");
    assert.equal(proposal.itemTypeCandidate, "unknown");
    assert.equal(
      proposal.supportedFacts.some((row) => row.value === "bracelet"),
      false,
    );
  });

  it("promotes itemType candidate to bracelet only after founder-reviewed artifact observation", () => {
    const { proposal, textReconstruction } = artifactProposal();
    assert.equal(textReconstruction.items[0]?.itemType, "unknown");
    assert.equal(proposal.itemTypeFromTextOnly, "unknown");
    assert.equal(proposal.itemTypeCandidate, "bracelet");
    assert.equal(fact(proposal, "item_type")?.value, "bracelet");
    assert.equal(fact(proposal, "item_type")?.source, "artifact");
    assert.equal(fact(proposal, "item_type")?.founderReviewed, true);
    assert.equal(fact(proposal, "item_type")?.canonical, false);
  });

  it("does not mutate text-only reconstruction evidence when augmenting with the artifact", () => {
    const input = aleaKnownThreadReconstructionInput();
    const textReconstruction = reconstructProjectBook(input);
    const before = JSON.stringify(textReconstruction);
    const proposal = buildProjectReconstructionProposal({
      textReconstruction,
      currentStored: input.currentSpecs,
      artifactObservation: founderReviewedAchedekalArtifactObservation(),
    });
    assert.equal(JSON.stringify(textReconstruction), before);
    assert.equal(textReconstruction.items[0]?.itemType, "unknown");
    assert.equal(textReconstruction.items[0]?.sizes.length, 0);
    assert.equal(proposal.itemTypeCandidate, "bracelet");
    assert.equal(
      textReconstruction.items.some((item) => item.itemType === "bracelet"),
      false,
    );
  });

  it("does not let founder memory become artifact evidence", () => {
    const founderReportedContext: FounderReportedContextItem[] = [
      {
        field: "client_name",
        value: "Alea Chedekal",
        source: "founder_reported",
        canonical: false,
        reconciledToArtifact: false,
        reconciledToCanonicalProject: false,
      },
      {
        field: "stone_material",
        value: "two marquise champagne sapphires were purchased",
        source: "founder_reported",
        canonical: false,
        reconciledToArtifact: false,
        reconciledToCanonicalProject: false,
      },
      {
        field: "contemplated_design",
        value: "marquise champagne-diamond station bracelet contemplated",
        source: "founder_reported",
        canonical: false,
        reconciledToArtifact: false,
        reconciledToCanonicalProject: false,
      },
    ];
    const { proposal, observation } = artifactProposal({
      founderReportedContext,
    });
    assert.equal(proposal.founderReportedContext.length, 3);
    assert.equal(
      proposal.founderReportedContext.every(
        (row) =>
          row.source === "founder_reported" &&
          row.canonical === false &&
          row.reconciledToArtifact === false,
      ),
      true,
    );
    assert.equal(
      proposal.supportedFacts.some((row) =>
        /champagne|sapphire|Alea Chedekal/i.test(row.value),
      ),
      false,
    );
    assert.equal(
      observation.observations.some((row) =>
        /champagne|sapphire/i.test(row.observedValue),
      ),
      false,
    );
    assert.equal(proposal.stoneLayout.material, null);
    assert.equal(
      proposal.supportedFacts.some((row) => row.source === "founder_reported"),
      false,
    );
  });
});

describe("bracelet length, stone layout, and component dimensions", () => {
  it("records finished length and extender from the artifact without mapping to finger_size", () => {
    const { proposal } = artifactProposal();
    assert.equal(proposal.braceletLength?.finishedLengthShown, "6.5 in");
    assert.equal(proposal.braceletLength?.extenderLengthShown, "1 in");
    assert.equal(proposal.braceletLength?.sizeType, "bracelet_length");
    assert.equal(proposal.braceletLength?.mapsToFingerSize, false);
    assert.equal(fact(proposal, "finished_length")?.value, "6.5 in");
    assert.equal(fact(proposal, "extender_length")?.value, "1 in");
    assert.equal(
      proposal.supportedFacts.some((row) => row.field === "finger_size"),
      false,
    );
    assert.equal(
      proposal.supportedFacts.some(
        (row) => row.mapsToFingerSize === true || row.field === "ring_size",
      ),
      false,
    );
  });

  it("records marquise layout and keeps CAD component dimensions separate from stones", () => {
    const { proposal, observation } = artifactProposal();
    assert.equal(proposal.stoneLayout.shape, "marquise / MQ");
    assert.equal(proposal.stoneLayout.size, "4.00 × 2.00 mm");
    assert.equal(proposal.stoneLayout.quantity, "5");
    assert.equal(proposal.stoneLayout.material, null);
    assert.equal(proposal.stoneLayout.color, null);
    assert.equal(proposal.stoneLayout.origin, null);
    assert.equal(proposal.stoneLayout.caratWeight, null);
    assert.equal(observationOf(observation, "stone_shape")?.category, "stone");
    assert.equal(observationOf(observation, "stone_size")?.category, "stone");
    assert.equal(
      observationOf(observation, "cad_component_overall_length")?.category,
      "cad_component",
    );
    assert.equal(proposal.cadComponentDimensions?.overallLength, "approx 8.0 mm");
    assert.equal(proposal.cadComponentDimensions?.bodyDetail, "approx 5.2 mm");
    assert.equal(proposal.cadComponentDimensions?.height, "approx 3.0 mm");
    assert.equal(proposal.cadComponentDimensions?.sideProfile, "approx 2.0 mm");
    assert.equal(proposal.cadComponentDimensions?.notGemstoneDimensions, true);
    assert.notEqual(
      proposal.stoneLayout.size,
      proposal.cadComponentDimensions?.overallLength,
    );
  });

  it("never transforms stored 141 or recovered 6.5/1 into finger_size", () => {
    const { proposal, input } = artifactProposal();
    const finger = proposal.conflictingStoredData.find(
      (row) => row.field === "finger_size",
    );
    assert.equal(input.currentSpecs.fingerSize, "141");
    assert.equal(finger?.storedValue, "141");
    assert.equal(finger?.transformed, false);
    assert.equal(finger?.corrected, false);
    assert.equal(finger?.deleted, false);
    assert.equal(finger?.currentStored, true);
    assert.equal(finger?.recoveredEvidence, false);
    assert.equal(
      proposal.supportedFacts.some(
        (row) => row.value === "141" || row.field === "finger_size",
      ),
      false,
    );
    assert.equal(
      proposal.supportedFacts.some(
        (row) =>
          (row.value === "6.5 in" || row.value === "1 in") &&
          row.field === "finger_size",
      ),
      false,
    );
  });
});

describe("malformed stored data quarantine", () => {
  it("shows finger_size 141 as unsupported current stored data, not recovered evidence", () => {
    const { proposal } = artifactProposal();
    const finger = proposal.conflictingStoredData.find(
      (row) => row.field === "finger_size",
    );
    assert.ok(finger);
    assert.equal(finger.storedValue, "141");
    assert.equal(finger.status, "unsupported_conflicting_with_item_context");
    assert.match(finger.reviewNote, /not supported/i);
    assert.match(finger.reviewNote, /bracelet project/i);
    assert.doesNotMatch(finger.reviewNote, /corrupt|should be 6\.5/i);
  });

  it("shows order 140 as unsupported current stored data and does not correct it", () => {
    const { proposal, input } = artifactProposal();
    const order = proposal.conflictingStoredData.find(
      (row) => row.field === "order_number",
    );
    assert.equal(input.currentSpecs.orderNumber, "140");
    assert.ok(order);
    assert.equal(order.storedValue, "140");
    assert.equal(order.status, "unsupported");
    assert.equal(order.corrected, false);
    assert.equal(order.deleted, false);
    assert.equal(order.recoveredEvidence, false);
    assert.equal(
      proposal.supportedFacts.some(
        (row) => row.field === "order_number" || row.value === "140",
      ),
      false,
    );
  });
});

describe("project state and founder-review independence", () => {
  it("does not promote CAD + bracelet observation to completed_sold or approved_in_production", () => {
    const { proposal } = artifactProposal();
    assert.equal(proposal.designArtifactPresent, true);
    assert.equal(proposal.artifactReviewedByFounder, true);
    assert.equal(proposal.projectState, "unknown");
    assert.equal(proposal.completedSold, false);
    assert.equal(proposal.approvedInProduction, false);
    assert.equal(proposal.completed, false);
    assert.equal(proposal.sold, false);
    assert.equal(proposal.approvedDesign, false);
    assert.equal(proposal.approvedForProduction, false);
    assert.equal(proposal.lifecycle, "historical_closed");
    assert.equal(
      proposal.unresolvedFacts.some((row) => row.field === "completion_sale_status"),
      true,
    );
  });

  it("does not treat founder review as design approval", () => {
    const { proposal } = artifactProposal();
    assert.equal(proposal.artifactReviewedByFounder, true);
    assert.equal(proposal.epistemicBoundary.founderReviewImpliesDesignApproval, false);
    assert.equal(proposal.epistemicBoundary.cadImpliesSold, false);
    assert.equal(proposal.epistemicBoundary.braceletCadImpliesDelivered, false);
    assert.equal(proposal.epistemicBoundary.decisionAuthorized, false);
    assert.equal(proposal.epistemicBoundary.actionAuthorized, false);
    assert.equal(proposal.epistemicBoundary.authorizedThrough, "observation");
  });
});

describe("reconstruction proposal mutation boundary", () => {
  it("is review-only with empty canonical writes and the reconstruction mutation boundary", () => {
    const { proposal } = artifactProposal();
    assert.equal(proposal.status, "review_only");
    assert.equal(proposal.automaticApply, false);
    assert.deepEqual(proposal.proposedCanonicalWrites, []);
    assert.deepEqual(proposal.mutationBoundary, RECONSTRUCTION_MUTATION_BOUNDARY);
    assert.equal(proposal.mutationBoundary.updatesProjectSpecs, false);
    assert.equal(proposal.mutationBoundary.updatesPersons, false);
    assert.equal(proposal.mutationBoundary.callsSliceC, false);
    assert.equal(proposal.mutationBoundary.createsSpecRevisions, false);
    assert.equal(proposal.mutationBoundary.changesLifecycle, false);
    assert.equal(proposal.mutationBoundary.createsOpenJobs, false);
    assert.equal(proposal.mutationBoundary.writesChiefOfStaff, false);
    assert.equal(proposal.mutationBoundary.fetchesGmail, false);
    assert.equal(proposal.mutationBoundary.fetchesAttachmentBytes, false);
    assert.equal(proposal.mutationBoundary.applyButton, false);
  });

  it("keeps the encoded Alea presentation path fetch-free and memory-free by default", () => {
    const proposal = presentAchedekalReconstructionProposal();
    assert.equal(proposal.projectId, ACHEDEKAL_PROJECT_ID);
    assert.equal(proposal.itemTypeCandidate, "bracelet");
    assert.equal(proposal.founderReportedContext.length, 0);
    assert.equal(proposal.automaticApply, false);
    assert.deepEqual(proposal.proposedCanonicalWrites, []);
    const view = reconstructionProposalView(proposal);
    assert.equal(view.applyButton, false);
    assert.equal(view.supportedFacts.find((row) => row.label === "Item")?.value, "Bracelet");
    assert.equal(view.supportedFacts.find((row) => row.label === "CAD")?.value, "CBR2000037");
    assert.equal(
      view.supportedFacts.find((row) => row.label === "Finished length shown")?.value,
      "6.5 in",
    );
    assert.equal(
      view.supportedFacts.find((row) => row.label === "Adjustment / extender shown")
        ?.value,
      "1 in",
    );
    assert.match(
      view.supportedFacts.find((row) => row.label === "Stone layout")?.value ?? "",
      /5 × marquise \(MQ\), 4\.00 × 2\.00 mm/,
    );
    assert.equal(
      view.supportedFacts.find((row) => row.label === "Design artifact")?.value,
      "Founder reviewed",
    );
    assert.equal(view.conflictingStoredData.length, 0);
    assert.equal(
      view.conflictingStoredData.some(
        (row) => row.value === "141" || row.value === "140",
      ),
      false,
    );
  });
});

describe("live Project Desk overlay vs fixture current stored data", () => {
  it("displays live overlay 7 / 999 instead of fixture 141 / 140", () => {
    const proposal = presentAchedekalReconstructionProposal({
      currentStored: { fingerSize: "7", orderNumber: "999" },
    });
    const finger = proposal.conflictingStoredData.find(
      (row) => row.field === "finger_size",
    );
    const order = proposal.conflictingStoredData.find(
      (row) => row.field === "order_number",
    );
    assert.equal(finger?.storedValue, "7");
    assert.equal(order?.storedValue, "999");
    assert.equal(finger?.currentStored, true);
    assert.equal(finger?.recoveredEvidence, false);
    assert.equal(order?.recoveredEvidence, false);
    assert.equal(
      proposal.conflictingStoredData.some(
        (row) => row.storedValue === "141" || row.storedValue === "140",
      ),
      false,
    );
    assert.equal(
      proposal.supportedFacts.some(
        (row) => row.value === "141" || row.value === "140",
      ),
      false,
    );
    const view = reconstructionProposalView(proposal);
    assert.equal(
      view.conflictingStoredData.find((row) => row.label === "Finger size")
        ?.value,
      "7",
    );
    assert.equal(
      view.conflictingStoredData.find((row) => row.label === "Order")?.value,
      "999",
    );
  });

  it("does not manufacture fixture 141 / 140 when the live overlay is null", () => {
    const proposal = presentAchedekalReconstructionProposal({
      currentStored: { fingerSize: null, orderNumber: null },
    });
    assert.equal(proposal.conflictingStoredData.length, 0);
    assert.equal(
      proposal.conflictingStoredData.some(
        (row) =>
          row.storedValue === "141" ||
          row.storedValue === "140" ||
          row.field === "finger_size" ||
          row.field === "order_number",
      ),
      false,
    );
    assert.equal(
      proposal.supportedFacts.some(
        (row) =>
          row.value === "141" ||
          row.value === "140" ||
          row.field === "finger_size" ||
          row.field === "order_number",
      ),
      false,
    );
    const view = reconstructionProposalView(proposal);
    assert.equal(view.conflictingStoredData.length, 0);
    assert.equal(
      view.conflictingStoredData.some(
        (row) => row.value === "141" || row.value === "140",
      ),
      false,
    );
  });

  it("does not manufacture fixture 141 / 140 when currentStored is omitted", () => {
    const proposal = presentAchedekalReconstructionProposal();
    assert.equal(proposal.conflictingStoredData.length, 0);
    assert.equal(
      proposal.supportedFacts.some(
        (row) => row.value === "141" || row.value === "140",
      ),
      false,
    );
  });

  it("still quarantines genuine live 141 / 140 from Project Desk", () => {
    const proposal = presentAchedekalReconstructionProposal({
      currentStored: { fingerSize: "141", orderNumber: "140" },
    });
    const view = reconstructionProposalView(proposal);
    assert.match(view.storedBanner, /not supported by recovered evidence/i);
    assert.match(
      view.conflictingStoredData.find((row) => row.label === "Order")?.note ?? "",
      /NOT INDEPENDENTLY SUPPORTED/,
    );
    assert.equal(view.supportedDoesNotMeanCanonical, true);
    assert.equal(proposal.storedFieldAssessments.every((row) => row.canonical === false), true);
    const finger = proposal.conflictingStoredData.find(
      (row) => row.field === "finger_size",
    );
    const order = proposal.conflictingStoredData.find(
      (row) => row.field === "order_number",
    );
    assert.equal(finger?.storedValue, "141");
    assert.equal(order?.storedValue, "140");
    assert.equal(finger?.currentStored, true);
    assert.equal(finger?.recoveredEvidence, false);
    assert.equal(finger?.corrected, false);
    assert.equal(finger?.transformed, false);
    assert.equal(order?.recoveredEvidence, false);
    assert.equal(order?.corrected, false);
    assert.equal(order?.transformed, false);
    assert.equal(
      proposal.supportedFacts.some(
        (row) =>
          row.value === "141" ||
          row.value === "140" ||
          row.field === "finger_size" ||
          row.field === "order_number",
      ),
      false,
    );
    assert.equal(
      view.conflictingStoredData.find((row) => row.label === "Finger size")
        ?.value,
      "141",
    );
    assert.equal(
      view.conflictingStoredData.find((row) => row.label === "Order")?.value,
      "140",
    );
  });
});

describe("reconstruction proposal privacy, UI, and privilege boundary", () => {
  it("keeps the proposal module off Gmail fetches, writers, vision, and persistence", () => {
    const proposal = sourceOf("lib/continuum/gmail/reconstruction-proposal.ts");
    const observation = sourceOf("lib/continuum/gmail/artifact-observation.ts");
    const ui = sourceOf(
      "app/executive-dashboard/concierge/components/achedekal-reconstruction-proposal.tsx",
    );
    const page = sourceOf(
      "app/executive-dashboard/concierge/project-reconstruction/achedekal/page.tsx",
    );
    const barrel = sourceOf("lib/continuum/gmail/index.ts");
    const server = sourceOf("lib/continuum/gmail/server.ts");
    for (const source of [proposal, observation, ui]) {
      assert.doesNotMatch(source, WRITER_PATTERN);
      assert.doesNotMatch(source, GMAIL_FETCH_PATTERN);
      assert.doesNotMatch(source, VISION_PATTERN);
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /gtag|analytics|localStorage|indexedDB/);
      assert.doesNotMatch(source, /project_kind\s*=/);
      assert.match(source, /canonical: false|canonical = false|Does not write/i);
    }
    assert.match(proposal, /automaticApply: false/);
    assert.match(proposal, /proposedCanonicalWrites: \[\]/);
    assert.doesNotMatch(
      proposal,
      /\?\?\s*known\.currentSpecs\.(fingerSize|orderNumber)/,
    );
    assert.match(ui, /conflictingStoredData\.length > 0/);
    assert.doesNotMatch(proposal, /from "\.\/achedekal-known-artifact"/);
    assert.doesNotMatch(proposal, /from "\.\/known-artifact-gmail"/);
    assert.doesNotMatch(barrel, /from "\.\/reconstruction-proposal"/);
    assert.doesNotMatch(server, /from "\.\/reconstruction-proposal"/);
    assert.doesNotMatch(barrel, /from "\.\/artifact-observation"/);
    assert.doesNotMatch(page, /getThread|listMessages|getMessage|getAttachment/);
    assert.doesNotMatch(page, /executeAchedekalKnownArtifactPreview|runExactProjectThreadFetch/);
    assert.match(page, /AchedekalReviewForm/);
    assert.match(page, /AchedekalRelatedThreadsForm/);
    assert.match(page, /AchedekalKnownArtifactPreview/);
    assert.match(page, /AchedekalReconstructionProposal/);
    assert.match(page, /presentAchedekalReconstructionProposal/);
    assert.match(page, /index: false/);
    assert.match(ui, /Reconstruction proposal/);
    assert.match(ui, /CAD component dimensions/);
    assert.doesNotMatch(ui, /Apply|Open Job|Approve design|Write project/i);
    assert.doesNotMatch(ui, /champagne|Alea Chedekal|two marquise/);
    assert.doesNotMatch(ui, /"use client"/);
    assert.doesNotMatch(ui, /fetch\(/);
    assert.doesNotMatch(observation, /H017-CBR2000037\.jpg[\s\S]{0,40}base64/);
  });

  it("does not hardcode founder personal history into the encoded proposal path", () => {
    const proposal = sourceOf("lib/continuum/gmail/reconstruction-proposal.ts");
    const observation = sourceOf("lib/continuum/gmail/artifact-observation.ts");
    for (const source of [proposal, observation]) {
      assert.doesNotMatch(source, /champagne/);
      assert.doesNotMatch(source, /Alea Chedekal/);
      assert.doesNotMatch(source, /two marquise champagne sapphires/);
    }
    const presented = presentAchedekalReconstructionProposal();
    assert.deepEqual(presented.founderReportedContext, []);
  });
});
