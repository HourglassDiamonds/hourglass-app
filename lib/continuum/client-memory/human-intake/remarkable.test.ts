import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { InMemoryClientMemoryStore } from "../store";
import { createInMemoryHumanSourceStore } from "./store";
import { sha256Bytes } from "./hash";
import {
  HUMAN_SOURCE_FILE_MAX_BYTES,
} from "./types";
import { ingestHumanEvidenceCandidates } from "@/lib/continuum/candidates/human-evidence";
import { InMemoryCandidateStore } from "@/lib/continuum/candidates/store";

const NOW = "2026-08-25T17:00:00.000Z";
const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3]);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("reMarkable human intake V1", () => {
  it("stores a founder-uploaded file without OCR or auto-memory", async () => {
    const memory = new InMemoryClientMemoryStore();
    const before = await memory.inspectCounts();
    const store = createInMemoryHumanSourceStore({
      nowIso: () => NOW,
      newSourceId: () => randomUUID(),
      names: { getEntity: (id) => memory.getEntity(id) },
    });
    const result = await store.ingest({
      sourceType: "remarkable",
      reportedCommunicationType: "handwritten",
      originalFileName: "page-1.png",
      rawFile: {
        bytes: PNG_BYTES,
        mimeType: "image/png",
        fileName: "page-1.png",
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const source = await store.getSource(result.sourceId);
    assert.equal(source?.sourceType, "remarkable");
    assert.equal(source?.originalFileName, "page-1.png");
    assert.equal(source?.rawText, null);
    assert.equal(source?.contentSha256, sha256Bytes(PNG_BYTES));
    assert.equal(source?.parseStatus, "stored");
    const candidates = new InMemoryCandidateStore();
    const extracted = await ingestHumanEvidenceCandidates(candidates, {
      source: source!,
    });
    assert.equal(extracted.status, "empty-text");
    assert.equal(extracted.candidates.length, 0);
    assert.deepEqual(await memory.inspectCounts(), before);
  });

  it("rejects a file that is not a PDF, PNG, or JPEG", async () => {
    const memory = new InMemoryClientMemoryStore();
    const store = createInMemoryHumanSourceStore({
      nowIso: () => NOW,
      newSourceId: () => randomUUID(),
      names: { getEntity: (id) => memory.getEntity(id) },
    });
    const result = await store.ingest({
      sourceType: "remarkable",
      reportedCommunicationType: "handwritten",
      originalFileName: "notes.txt",
      rawFile: {
        bytes: PNG_BYTES,
        mimeType: "text/plain",
        fileName: "notes.txt",
      },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "invalid-input");
    if (result.reason !== "invalid-input") return;
    assert.equal(result.code, "invalid-mime");
  });

  it("rejects an export larger than 1 MB", async () => {
    const memory = new InMemoryClientMemoryStore();
    const store = createInMemoryHumanSourceStore({
      nowIso: () => NOW,
      newSourceId: () => randomUUID(),
      names: { getEntity: (id) => memory.getEntity(id) },
    });
    const result = await store.ingest({
      sourceType: "remarkable",
      reportedCommunicationType: "handwritten",
      originalFileName: "huge.pdf",
      rawFile: {
        bytes: new Uint8Array(HUMAN_SOURCE_FILE_MAX_BYTES + 1),
        mimeType: "application/pdf",
        fileName: "huge.pdf",
      },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "invalid-input");
    if (result.reason !== "invalid-input") return;
    assert.equal(result.code, "oversized-file");
  });

  it("extracts candidates from associated text without approving them", async () => {
    const memory = new InMemoryClientMemoryStore();
    const store = createInMemoryHumanSourceStore({
      nowIso: () => NOW,
      newSourceId: () => randomUUID(),
      names: { getEntity: (id) => memory.getEntity(id) },
    });
    const result = await store.ingest({
      sourceType: "remarkable",
      reportedCommunicationType: "handwritten",
      rawText: "I'll send the revision tomorrow.",
      originalFileName: "notes.pdf",
      rawFile: {
        bytes: PNG_BYTES,
        mimeType: "application/pdf",
        fileName: "notes.pdf",
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const source = await store.getSource(result.sourceId);
    const candidates = new InMemoryCandidateStore();
    const extracted = await ingestHumanEvidenceCandidates(candidates, {
      source: source!,
    });
    assert.equal(extracted.status, "proposed");
    assert.ok(extracted.candidates.some((row) => row.candidateType === "open_job"));
    assert.ok(extracted.candidates.every((row) => row.reviewStatus === "pending"));
    assert.ok(extracted.candidates.every((row) => row.sourceSystem === "remarkable"));
    assert.ok(extracted.candidates.every((row) => row.canonical === false));
    assert.ok(extracted.candidates.every((row) => row.automaticApply === false));
  });

  it("does not import OCR or Diamond Intelligence extractors", () => {
    const remarkable = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "remarkable.ts"),
      "utf8",
    );
    const ingest = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "ingest.ts"),
      "utf8",
    );
    const action = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/actions.ts"),
      "utf8",
    );
    for (const source of [remarkable, ingest, action]) {
      assert.doesNotMatch(source, /extractPdfTextLayer|tesseract|diamond-intelligence/i);
      assert.doesNotMatch(source, /openai|anthropic/i);
    }
    const page = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/inbox/remarkable/page.tsx"),
      "utf8",
    );
    assert.match(page, /does not OCR/);
    assert.match(page, /AddRemarkableForm/);
  });
});
