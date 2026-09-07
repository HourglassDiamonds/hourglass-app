import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { InMemoryClientMemoryStore } from "@/lib/continuum/client-memory/store";
import { createInMemoryHumanSourceStore } from "@/lib/continuum/client-memory/human-intake/store";
import { CANDIDATE_MUTATION_BOUNDARY, CANDIDATE_PARSER_HUMAN_INTAKE_V1 } from "./types";
import type { ContinuumCandidateDraft } from "./types";
import { assignCandidateId, candidateIdFromIdentity, candidateIdentityKey } from "./identity";
import { InMemoryCandidateStore } from "./store";
import { SqlMappedCandidateStore } from "./sql-mapped-store";
import {
  ingestHumanEvidenceCandidates,
  normalizeHumanSourceEvidence,
  proposeHumanEvidenceCandidates,
} from "./human-evidence";
import {
  packHumanEvidenceSourceRef,
  parseHumanEvidenceSourceRef,
} from "./human-evidence-source-ref";
import { proposeParsedHumanEvidence } from "@/lib/continuum/human-intake/candidates/propose";
import { proposeHumanIntakeCandidates } from "@/lib/continuum/human-intake/candidates/propose";
import { packHumanIntakeCandidateSourceRef } from "@/lib/continuum/human-intake/candidates/source-ref";

const NOW = "2026-08-25T17:00:00.000Z";
const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3]);
const PROJECT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PARSER = join(
  dirname(fileURLToPath(import.meta.url)),
  "../human-intake/candidates/parse.ts",
);

const COMMITMENT = "I'll send the revision tomorrow.";

function gmailNoteDraft(text: string): ContinuumCandidateDraft {
  return {
    candidateId: "",
    sourceSystem: "gmail",
    sourceRef: "gc1|thread-same|msg-same",
    sourceTimestamp: NOW,
    candidateType: "note",
    proposedTarget: { kind: "none" },
    payload: { kind: "note", text, contextLayer: null },
    confidence: "medium",
    evidenceBasis: { ruleIds: ["gmail-note"], matchedText: text },
    candidateState: "active",
    createdAt: NOW,
    canonical: false,
    automaticApply: false,
    parserVersion: "gmail-candidates-deterministic-v1",
  };
}

describe("human evidence source adapters", () => {
  it("uses the shared #18 parser and does not keep an awaiting-parser seam", () => {
    const adapter = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "human-evidence.ts"),
      "utf8",
    );
    const parser = readFileSync(PARSER, "utf8");
    assert.match(adapter, /proposeParsedHumanEvidence/);
    assert.doesNotMatch(adapter, /HUMAN_EVIDENCE_PARSER_SEAM|awaiting-parser/);
    assert.doesNotMatch(parser, /sourceSystem|sourceRef/);
    assert.doesNotMatch(parser, /parse\.ts/);
  });

  it("normalizes PLAUD to source_system plaud with provenance back to the source id", async () => {
    const store = createInMemoryHumanSourceStore({
      nowIso: () => NOW,
      newSourceId: () => randomUUID(),
      names: { getEntity: async () => null },
    });
    const ingested = await store.ingest({
      sourceType: "plaud",
      rawText: "Call recap: she likes the cathedral lower.",
      reportedCommunicationType: "call",
    });
    assert.equal(ingested.ok, true);
    if (!ingested.ok) return;
    const source = await store.getSource(ingested.sourceId);
    assert.ok(source);
    const normalized = normalizeHumanSourceEvidence({ source: source! });
    assert.equal(normalized.ok, true);
    if (!normalized.ok) return;
    assert.equal(normalized.evidence.sourceSystem, "plaud");
    assert.equal(normalized.evidence.textOrigin, "source-text");
    assert.equal(normalized.evidence.provenanceClass, "founder-captured");
    assert.equal(
      parseHumanEvidenceSourceRef(normalized.evidence.sourceRef)?.sourceId,
      ingested.sourceId,
    );
    assert.equal(normalized.evidence.contentSha256, source!.contentSha256);
  });

  it("proposes ContinuumCandidates as pending, non-canonical, and not auto-applied", async () => {
    const human = createInMemoryHumanSourceStore({
      nowIso: () => NOW,
      newSourceId: () => randomUUID(),
      names: { getEntity: async () => null },
    });
    const ingested = await human.ingest({
      sourceType: "plaud",
      rawText: COMMITMENT,
      reportedCommunicationType: "voice-memo",
    });
    assert.equal(ingested.ok, true);
    if (!ingested.ok) return;
    const source = await human.getSource(ingested.sourceId);
    assert.ok(source);
    const candidates = new InMemoryCandidateStore();
    const result = await ingestHumanEvidenceCandidates(candidates, {
      source: source!,
      createdAt: NOW,
    });
    assert.equal(result.status, "proposed");
    assert.equal(result.liveModelCalls, false);
    assert.equal(result.mutationBoundary, CANDIDATE_MUTATION_BOUNDARY);
    assert.equal(result.parserVersion, CANDIDATE_PARSER_HUMAN_INTAKE_V1);
    assert.ok(result.candidates.length >= 1);
    assert.ok(result.candidates.every((row) => row.sourceSystem === "plaud"));
    assert.ok(result.candidates.every((row) => row.reviewStatus === "pending"));
    assert.ok(result.candidates.every((row) => row.lastReviewAction === null));
    assert.ok(result.candidates.every((row) => row.canonical === false));
    assert.ok(result.candidates.every((row) => row.automaticApply === false));
    assert.ok(
      result.candidates.every(
        (row) => parseHumanEvidenceSourceRef(row.sourceRef)?.sourceId === ingested.sourceId,
      ),
    );
    const job = result.candidates.find((row) => row.candidateType === "open_job");
    assert.ok(job);
    assert.equal(job?.payload.kind, "open_job");
    if (job?.payload.kind === "open_job") {
      assert.equal(job.payload.createJob, false);
    }
  });

  it("does not let the shared parser overwrite adapter sourceSystem or sourceRef", () => {
    const sourceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const packed = packHumanEvidenceSourceRef({
      sourceId,
      start: 0,
      end: COMMITMENT.length,
    });
    assert.equal(packed.ok, true);
    if (!packed.ok) return;
    const proposed = proposeParsedHumanEvidence({
      sourceSystem: "plaud",
      packSourceRef: () => packed,
      evidence: { sourceId, text: COMMITMENT, capturedAt: NOW },
      world: { people: [], projects: [] },
      createdAt: NOW,
    });
    assert.ok(proposed.candidates.length >= 1);
    assert.ok(proposed.candidates.every((row) => row.sourceSystem === "plaud"));
    assert.ok(proposed.candidates.every((row) => row.sourceRef === packed.sourceRef));
    const intake = proposeHumanIntakeCandidates({
      evidence: { sourceId, text: COMMITMENT, capturedAt: NOW },
      world: { people: [], projects: [] },
      createdAt: NOW,
    });
    assert.ok(intake.candidates.every((row) => row.sourceSystem === "human-intake"));
    assert.notEqual(intake.candidates[0]?.candidateId, proposed.candidates[0]?.candidateId);
  });

  it("stamps remarkable source_system and skips OCR for file-only uploads", async () => {
    const human = createInMemoryHumanSourceStore({
      nowIso: () => NOW,
      newSourceId: () => randomUUID(),
      names: { getEntity: async () => null },
    });
    const ingested = await human.ingest({
      sourceType: "remarkable",
      reportedCommunicationType: "handwritten",
      originalFileName: "page-1.png",
      rawFile: {
        bytes: PNG_BYTES,
        mimeType: "image/png",
        fileName: "page-1.png",
      },
    });
    assert.equal(ingested.ok, true);
    if (!ingested.ok) return;
    const source = await human.getSource(ingested.sourceId);
    assert.equal(source?.rawText, null);
    const normalized = normalizeHumanSourceEvidence({ source: source! });
    assert.equal(normalized.ok, true);
    if (!normalized.ok) return;
    assert.equal(normalized.evidence.sourceSystem, "remarkable");
    assert.equal(normalized.evidence.textOrigin, "none");
    assert.equal(normalized.evidence.originalFileName, "page-1.png");
    const proposed = proposeHumanEvidenceCandidates({
      evidence: normalized.evidence,
    });
    assert.equal(proposed.status, "empty-text");
    assert.equal(proposed.candidates.length, 0);
  });

  it("proposes from reMarkable associated text without auto-review or auto-write", async () => {
    const memory = new InMemoryClientMemoryStore();
    const before = await memory.inspectCounts();
    const human = createInMemoryHumanSourceStore({
      nowIso: () => NOW,
      newSourceId: () => randomUUID(),
      names: { getEntity: (id) => memory.getEntity(id) },
    });
    const ingested = await human.ingest({
      sourceType: "remarkable",
      reportedCommunicationType: "handwritten",
      rawText: COMMITMENT,
      originalFileName: "notes.pdf",
      rawFile: {
        bytes: PNG_BYTES,
        mimeType: "application/pdf",
        fileName: "notes.pdf",
      },
    });
    assert.equal(ingested.ok, true);
    if (!ingested.ok) return;
    const source = await human.getSource(ingested.sourceId);
    const candidates = new InMemoryCandidateStore();
    const result = await ingestHumanEvidenceCandidates(candidates, {
      source: source!,
    });
    assert.ok(result.candidates.length >= 1);
    const row = result.candidates[0]!;
    assert.equal(row.sourceSystem, "remarkable");
    assert.equal(row.reviewStatus, "pending");
    assert.equal(row.canonical, false);
    assert.equal(row.automaticApply, false);
    assert.deepEqual(await memory.inspectCounts(), before);
  });

  it("does not collapse equivalent-looking Gmail, Human Intake, PLAUD, and reMarkable evidence", async () => {
    const text = COMMITMENT;
    const sourceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const gmail = assignCandidateId(gmailNoteDraft(text));
    const intake = proposeHumanIntakeCandidates({
      evidence: { sourceId, text, capturedAt: NOW },
      world: { people: [], projects: [] },
      createdAt: NOW,
    });
    const plaud = proposeParsedHumanEvidence({
      sourceSystem: "plaud",
      packSourceRef: ({ start, end }) =>
        packHumanEvidenceSourceRef({ sourceId, start, end }),
      evidence: { sourceId, text, capturedAt: NOW },
      world: { people: [], projects: [] },
      createdAt: NOW,
    });
    const remarkable = proposeParsedHumanEvidence({
      sourceSystem: "remarkable",
      packSourceRef: ({ start, end }) =>
        packHumanEvidenceSourceRef({ sourceId, start, end }),
      evidence: { sourceId, text, capturedAt: NOW },
      world: { people: [], projects: [] },
      createdAt: NOW,
    });
    assert.ok(intake.candidates.length >= 1);
    assert.ok(plaud.candidates.length >= 1);
    assert.ok(remarkable.candidates.length >= 1);
    const ids = new Set([
      gmail.candidateId,
      intake.candidates[0]!.candidateId,
      plaud.candidates[0]!.candidateId,
      remarkable.candidates[0]!.candidateId,
    ]);
    assert.equal(ids.size, 4);
    assert.notEqual(
      candidateIdFromIdentity(candidateIdentityKey(plaud.candidates[0]!)),
      candidateIdFromIdentity(candidateIdentityKey(remarkable.candidates[0]!)),
    );
    const hiPacked = packHumanIntakeCandidateSourceRef({
      sourceId,
      start: 0,
      end: text.length,
    });
    const hePacked = packHumanEvidenceSourceRef({
      sourceId,
      start: 0,
      end: text.length,
    });
    assert.equal(hiPacked.ok, true);
    assert.equal(hePacked.ok, true);
    if (hiPacked.ok && hePacked.ok) {
      assert.notEqual(hiPacked.sourceRef, hePacked.sourceRef);
    }
  });

  it("reprocessing the same PLAUD source is idempotent on Candidate identity", async () => {
    const human = createInMemoryHumanSourceStore({
      nowIso: () => NOW,
      newSourceId: () => randomUUID(),
      names: { getEntity: async () => null },
    });
    const ingested = await human.ingest({
      sourceType: "plaud",
      rawText: COMMITMENT,
      reportedCommunicationType: "call",
    });
    assert.equal(ingested.ok, true);
    if (!ingested.ok) return;
    const source = await human.getSource(ingested.sourceId);
    const store = new InMemoryCandidateStore();
    const first = await ingestHumanEvidenceCandidates(store, {
      source: source!,
    });
    const second = await ingestHumanEvidenceCandidates(store, {
      source: source!,
    });
    assert.ok(first.insertedIds.length >= 1);
    assert.equal(second.insertedIds.length, 0);
    assert.ok(second.duplicateIds.length >= 1);
    assert.equal(second.duplicateIds[0], first.insertedIds[0]);
    const row = (await store.list()).find(
      (item) => item.candidateId === first.insertedIds[0],
    );
    assert.equal(row?.reviewStatus, "pending");
  });

  it("reprocessing the same reMarkable source is idempotent on Candidate identity", async () => {
    const human = createInMemoryHumanSourceStore({
      nowIso: () => NOW,
      newSourceId: () => randomUUID(),
      names: { getEntity: async () => null },
    });
    const ingested = await human.ingest({
      sourceType: "remarkable",
      reportedCommunicationType: "handwritten",
      rawText: COMMITMENT,
      originalFileName: "notes.pdf",
      rawFile: {
        bytes: PNG_BYTES,
        mimeType: "application/pdf",
        fileName: "notes.pdf",
      },
    });
    assert.equal(ingested.ok, true);
    if (!ingested.ok) return;
    const source = await human.getSource(ingested.sourceId);
    const store = new InMemoryCandidateStore();
    const first = await ingestHumanEvidenceCandidates(store, { source: source! });
    const second = await ingestHumanEvidenceCandidates(store, { source: source! });
    assert.ok(first.insertedIds.length >= 1);
    assert.deepEqual(second.insertedIds, []);
    assert.ok(second.duplicateIds.includes(first.insertedIds[0]!));
  });

  it("does not resurrect reviewed PLAUD or reMarkable candidates", async () => {
    const statuses = ["approved", "discarded", "deferred"] as const;
    for (const sourceType of ["plaud", "remarkable"] as const) {
      for (const status of statuses) {
        const human = createInMemoryHumanSourceStore({
          nowIso: () => NOW,
          newSourceId: () => randomUUID(),
          names: { getEntity: async () => null },
        });
        const ingested = await human.ingest(
          sourceType === "plaud"
            ? {
                sourceType,
                rawText: "Finger size is 6.5.",
                reportedCommunicationType: "call",
              }
            : {
                sourceType,
                reportedCommunicationType: "handwritten",
                rawText: "Finger size is 6.5.",
                originalFileName: "notes.pdf",
                rawFile: {
                  bytes: PNG_BYTES,
                  mimeType: "application/pdf",
                  fileName: "notes.pdf",
                },
              },
        );
        assert.equal(ingested.ok, true);
        if (!ingested.ok) return;
        const source = await human.getSource(ingested.sourceId);
        const store = new SqlMappedCandidateStore();
        const first = await ingestHumanEvidenceCandidates(store, {
          source: source!,
          projectId: PROJECT_ID,
          world: {
            people: [],
            projects: [{ projectId: PROJECT_ID, title: "Oval ring", fingerSize: "6" }],
          },
        });
        const spec = first.candidates.find(
          (row) =>
            row.payload.kind === "structured_spec" &&
            row.payload.fieldName === "finger_size",
        );
        assert.ok(spec, `${sourceType} ${status}`);
        const action =
          status === "approved"
            ? "approve"
            : status === "discarded"
              ? "discard"
              : "defer";
        await store.applyReview(spec!.candidateId, { action }, NOW);
        const second = await ingestHumanEvidenceCandidates(store, {
          source: source!,
          projectId: PROJECT_ID,
          world: {
            people: [],
            projects: [{ projectId: PROJECT_ID, title: "Oval ring", fingerSize: "6" }],
          },
        });
        const after = await store.get(spec!.candidateId);
        assert.equal(after?.reviewStatus, status);
        assert.ok(second.duplicateIds.includes(spec!.candidateId));
      }
    }
  });

  it("does not resurrect an edited PLAUD candidate to pending", async () => {
    const human = createInMemoryHumanSourceStore({
      nowIso: () => NOW,
      newSourceId: () => randomUUID(),
      names: { getEntity: async () => null },
    });
    const ingested = await human.ingest({
      sourceType: "plaud",
      rawText: "Finger size is 6.5.",
      reportedCommunicationType: "call",
    });
    assert.equal(ingested.ok, true);
    if (!ingested.ok) return;
    const source = await human.getSource(ingested.sourceId);
    const store = new SqlMappedCandidateStore();
    const first = await ingestHumanEvidenceCandidates(store, {
      source: source!,
      projectId: PROJECT_ID,
      world: {
        people: [],
        projects: [{ projectId: PROJECT_ID, title: "Oval ring", fingerSize: "6" }],
      },
    });
    const spec = first.candidates.find(
      (row) =>
        row.payload.kind === "structured_spec" &&
        row.payload.fieldName === "finger_size",
    );
    assert.ok(spec);
    assert.equal(spec?.payload.kind, "structured_spec");
    if (spec?.payload.kind !== "structured_spec") return;
    await store.applyReview(
      spec.candidateId,
      {
        action: "edit",
        payload: { ...spec.payload, proposedValue: "7" },
      },
      NOW,
    );
    await ingestHumanEvidenceCandidates(store, {
      source: source!,
      projectId: PROJECT_ID,
      world: {
        people: [],
        projects: [{ projectId: PROJECT_ID, title: "Oval ring", fingerSize: "6" }],
      },
    });
    const after = await store.get(spec.candidateId);
    assert.equal(after?.reviewStatus, "pending");
    assert.equal(after?.lastReviewAction, "edit");
    assert.equal(after?.founderEditedPayload?.kind, "structured_spec");
    if (after?.founderEditedPayload?.kind === "structured_spec") {
      assert.equal(after.founderEditedPayload.proposedValue, "7");
    }
  });
});
