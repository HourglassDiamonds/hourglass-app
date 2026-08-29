import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractCadJobIdentifiers } from "./cad-job-identifier";
import {
  ALEA_KNOWN_CAD,
  ALEA_KNOWN_FALSE_RENDER_TOKEN,
  aleaKnownProtectedThread,
  aleaKnownThreadReconstructionInput,
} from "./alea-known-thread-fixture";
import { presentAchedekalReview } from "./achedekal-review";
import {
  classifyItemState,
  reconstructProjectBook,
  RECONSTRUCTION_MUTATION_BOUNDARY,
} from "./project-reconstruction";
import {
  buildExactThreadReconstructionHandoff,
  collectExactThreadEvidence,
} from "./reconstruction-evidence";

const VENDOR_CAD_BODY = `Please find the following for Cad: CBR2000037
Cad presentation
Click here for video rendering:
https://example.test/render/DB865C70`;

describe("known-thread CAD extraction cleanup", () => {
  it("rejects DB865C70-like URL fragments and keeps CBR2000037", () => {
    assert.deepEqual(extractCadJobIdentifiers(VENDOR_CAD_BODY), [ALEA_KNOWN_CAD]);
    assert.equal(
      extractCadJobIdentifiers(VENDOR_CAD_BODY).includes(ALEA_KNOWN_FALSE_RENDER_TOKEN),
      false,
    );
  });

  it("rejects CAD presentation stopwords and other link fragments", () => {
    assert.deepEqual(extractCadJobIdentifiers("CAD presentation"), []);
    assert.deepEqual(
      extractCadJobIdentifiers("Click here for video rendering: https://example.test/x?id=DB865C70#FACE12AB"),
      [],
    );
    assert.deepEqual(extractCadJobIdentifiers("cid:ii_db865c70"), []);
  });
});

describe("known-thread evidence deduplication", () => {
  it("deduplicates repeated CBR evidence and preserves provenance occurrences", () => {
    const evidence = collectExactThreadEvidence(aleaKnownProtectedThread(), [
      ALEA_KNOWN_CAD,
    ]);
    const cad = evidence.filter((row) => row.kind === "cad_job_number");
    assert.equal(cad.length, 1);
    assert.equal(cad[0]?.proposedValue, ALEA_KNOWN_CAD);
    assert.equal(cad[0]?.occurrences?.length, 4);
    const sources = (cad[0]?.occurrences ?? []).map((row) => row.source).sort();
    assert.deepEqual(sources, [
      "header-subject",
      "header-subject",
      "plain-text",
      "plain-text",
    ]);
    assert.equal(
      evidence.some(
        (row) =>
          row.kind === "cad_job_number" &&
          row.proposedValue === ALEA_KNOWN_FALSE_RENDER_TOKEN,
      ),
      false,
    );

    const view = presentAchedekalReview(
      buildExactThreadReconstructionHandoff({
        projectId: aleaKnownThreadReconstructionInput().projectId,
        currentSpecs: aleaKnownThreadReconstructionInput().currentSpecs,
        thread: aleaKnownProtectedThread(),
      }),
    );
    const cadRows = view.candidates.filter((row) => row.field === "cad_job_number");
    assert.equal(cadRows.length, 1);
    assert.equal(cadRows[0]?.candidateValue, ALEA_KNOWN_CAD);
    assert.equal(cadRows[0]?.occurrenceCount, 4);
    assert.equal(cadRows[0]?.occurrences.length, 4);
  });

  it("does not multiply CAD identity authority from repeated occurrences", () => {
    const handoff = reconstructProjectBook(aleaKnownThreadReconstructionInput());
    const item = handoff.items[0];
    assert.ok(item);
    assert.equal(item.cadJobNumbers.length, 1);
    assert.equal(item.cadJobNumbers[0]?.proposedValue, ALEA_KNOWN_CAD);
    assert.equal(item.cadJobNumbers[0]?.confidence, "strong");
    assert.equal(item.cadJobNumbers[0]?.occurrences?.length, 4);
    const cadIdentifiers = handoff.relatedThreads.identifiers.filter(
      (row) => row.kind === "cad_job_number" && row.value === ALEA_KNOWN_CAD,
    );
    assert.equal(cadIdentifiers.length, 1);
    assert.equal(
      handoff.relatedThreads.identifiers.some(
        (row) => row.value === ALEA_KNOWN_FALSE_RENDER_TOKEN,
      ),
      false,
    );
  });
});

describe("known-thread conservative reconstruction", () => {
  it("does not infer item type from stored finger_size 141 or founder bracelet memory", () => {
    const handoff = reconstructProjectBook(aleaKnownThreadReconstructionInput());
    assert.equal(handoff.projectShape, "unknown");
    assert.equal(handoff.items.length, 1);
    assert.equal(handoff.items[0]?.itemType, "unknown");
    assert.equal(
      handoff.items.some((item) => item.itemType === "ring"),
      false,
    );
    assert.equal(
      handoff.items.some((item) => item.itemType === "bracelet"),
      false,
    );
    assert.equal(handoff.items[0]?.sizes.length, 0);
  });

  it("does not treat CAD presentation as a completed sale or production approval", () => {
    assert.equal(classifyItemState("Cad presentation"), "unknown");
    assert.equal(
      classifyItemState("Please find the following for Cad: CBR2000037 Cad presentation"),
      "unknown",
    );
    const handoff = reconstructProjectBook(aleaKnownThreadReconstructionInput());
    assert.equal(handoff.items[0]?.state, "unknown");
    assert.equal(handoff.items[0]?.owned, false);
    assert.equal(handoff.items[0]?.designArtifactPresent, true);
  });

  it("does not propose size or order corrections from stored 141/140", () => {
    const input = aleaKnownThreadReconstructionInput();
    const evidence = collectExactThreadEvidence(input.thread, [ALEA_KNOWN_CAD]);
    assert.equal(
      evidence.some((row) => row.kind === "finger_size"),
      false,
    );
    assert.equal(
      evidence.some((row) => row.kind === "order_number"),
      false,
    );
    const handoff = buildExactThreadReconstructionHandoff({
      projectId: input.projectId,
      currentSpecs: input.currentSpecs,
      thread: input.thread,
    });
    assert.deepEqual(handoff.proposedCorrections, []);
    assert.equal(handoff.currentSpecs.fingerSize, "141");
    assert.equal(handoff.currentSpecs.orderNumber, "140");
    const view = presentAchedekalReview(handoff);
    assert.equal(view.ringSizeStatus, "none");
    assert.deepEqual(view.proposedCorrections, []);
    const reconstructed = reconstructProjectBook(input);
    assert.equal(reconstructed.items[0]?.orderNumbers.length, 0);
    assert.equal(reconstructed.items[0]?.sizes.length, 0);
  });

  it("remains candidate-only with no canonical writes", () => {
    const handoff = reconstructProjectBook(aleaKnownThreadReconstructionInput());
    assert.equal(handoff.automaticApply, false);
    assert.deepEqual(handoff.proposedCanonicalWrites, []);
    assert.deepEqual(handoff.mutationBoundary, RECONSTRUCTION_MUTATION_BOUNDARY);
    assert.equal(handoff.mutationBoundary.updatesProjectSpecs, false);
    assert.equal(handoff.mutationBoundary.updatesPersons, false);
    assert.equal(handoff.mutationBoundary.callsSliceC, false);
    assert.equal(handoff.lifecycle, "historical_closed");
    const view = presentAchedekalReview(
      buildExactThreadReconstructionHandoff({
        projectId: handoff.projectId,
        currentSpecs: aleaKnownThreadReconstructionInput().currentSpecs,
        thread: aleaKnownProtectedThread(),
      }),
    );
    assert.equal(view.automaticApply, false);
  });
});
