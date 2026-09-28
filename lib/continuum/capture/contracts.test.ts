import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as capture from "./index";
import type { CaptureProposal, CaptureProposedItem, CaptureRequest, CaptureCommitInput } from "./index";

const personId = "11111111-1111-4111-8111-111111111111";
const mutationId = "22222222-2222-4222-8222-222222222222";
const item: CaptureProposedItem = {
  itemId: "item-1", kind: "action", sourceExcerpt: "Call Sam tomorrow",
  title: "Call Sam", content: "Call Sam about the design", confidence: 0.8,
  timing: { kind: "date-only", date: "2026-09-29", originalWording: "tomorrow" },
};
const proposal: CaptureProposal = { version: 1, captureId: "capture-1", canonical: false, items: [item] };
const request: CaptureRequest = { captureId: "capture-1", text: "Call Sam tomorrow", provenance: "text",
  referenceTime: "2026-09-28T12:00:00-04:00", timezone: "America/New_York", requestedModel: "gpt-6-sol" };

describe("capture foundation", () => {
  it("represents multiple independent items and timing without conflating deadlines and instants", () => {
    const reminder: CaptureProposedItem = { ...item, itemId: "item-2", kind: "reminder",
      timing: { kind: "exact-instant", instantAt: "2026-09-29T15:00:00-04:00", timezone: "America/New_York", originalWording: "tomorrow at 3 PM" } };
    const watching: CaptureProposedItem = { ...item, itemId: "item-3", kind: "watching",
      timing: { kind: "checkpoint", originalWording: "if no reply by Friday", condition: "No reply received",
        checkAt: { kind: "date-only", date: "2026-10-02", originalWording: "Friday" } } };
    assert.equal(capture.isCaptureProposal({ ...proposal, items: [item, reminder, watching, { ...item, itemId: "item-4", kind: "note" }] }), true);
    assert.notEqual(item.timing?.kind, reminder.timing?.kind);
    assert.equal(capture.isCaptureTiming({ kind: "unspecified", originalWording: "" }), true);
    assert.equal(capture.isCaptureTiming({ ...reminder.timing, dueAt: "2026-09-29" }), false);
    assert.equal(capture.isCaptureTiming({ ...item.timing, date: "2026-09-29T15:00:00Z" }), false);
  });
  it("supports ambiguity and missing identity without turning names into IDs", () => {
    for (const resolution of [undefined, { status: "unresolved", mention: "Sam" },
      { status: "ambiguous", candidates: [{ kind: "person", id: personId, evidence: "Name match only; needs confirmation" }] },
      { status: "resolved", personId, evidence: "Founder selected an existing record" }]) {
      const candidate = resolution === undefined ? item : { ...item, entityResolution: resolution };
      assert.equal(capture.isCaptureProposedItem(candidate), true);
    }
    for (const resolution of [{ status: "resolved", personId: "Sam", evidence: "Capitalized name" },
      { status: "resolved", evidence: "Sam" }, { status: "unresolved", mention: "Sam", personId },
      { status: "ambiguous", candidates: [] }]) assert.equal(capture.isCaptureEntityResolution(resolution), false);
  });
  it("uses the same request shape for text and voice and rejects unsupported model requests", () => {
    assert.equal(capture.isCaptureRequest(request), true);
    assert.equal(capture.isCaptureRequest({ ...request, provenance: "voice", context: { personId } }), true);
    for (const patch of [{ requestedModel: "gpt-6-astra" }, { requestedModel: "gpt-5.6" },
      { referenceTime: "2026-02-30T12:00:00Z" }, { referenceTime: "2026-09-28T12:00:00" },
      { timezone: "invented/zone" }, { context: { personId: "Sam" } }]) {
      assert.equal(capture.isCaptureRequest({ ...request, ...patch }), false);
    }
  });
  it("rejects malformed output, duplicate IDs, and attempts to add persistence instructions", () => {
    for (const patch of [{ version: 2 }, { canonical: true }, { persist: true }, { items: [item, item] },
      { items: [{ ...item, confidence: NaN }] }, { items: [{ ...item, confidence: 1.1 }] },
      { items: [{ ...item, confidence: "0.8" }] }, { items: [{ ...item, kind: "event" }] },
      { items: [{ ...item, title: "" }] }, { items: [{ ...item, execute: "save" }] }]) {
      assert.equal(capture.isCaptureProposal({ ...proposal, ...patch }), false);
    }
    assert.equal(capture.isCaptureTiming({ kind: "date-only", date: "2026-02-30", originalWording: "February 30" }), false);
    assert.equal(capture.isCaptureTiming({ kind: "exact-instant", instantAt: "2026-09-29T25:00:00Z", timezone: "UTC", originalWording: "bad time" }), false);
  });
  it("represents edited confirmations and per-item outcomes without implementing saves", () => {
    const input: CaptureCommitInput = { version: 1, captureId: proposal.captureId, items: [
      { itemId: item.itemId, selected: true, mutationId, confirmedItem: { ...item, title: "Call Samuel" } },
      { itemId: "item-2", selected: false },
    ] };
    assert.equal(capture.isCaptureCommitInput(input), true);
    assert.equal(capture.isCaptureCommitInput({ ...input, items: [{ ...input.items[0], itemId: "mismatch" }] }), false);
    assert.equal(capture.isCaptureCommitInput({ ...input, items: [input.items[0], { ...input.items[0], itemId: "item-2", confirmedItem: { ...item, itemId: "item-2" } }] }), false);
    for (const status of ["saved", "already-present"]) assert.equal(capture.isCaptureCommitResult({ version: 1, captureId: "capture-1",
      items: [{ itemId: "item-1", status, target: { kind: "open_job", id: personId } }] }), true);
    for (const status of ["needs-review", "failed"]) assert.equal(capture.isCaptureCommitResult({ version: 1, captureId: "capture-1",
      items: [{ itemId: "item-1", status, message: "Review required" }] }), true);
    assert.equal(capture.isCaptureCommitResult({ version: 1, captureId: "capture-1", items: [{ itemId: "item-1", status: "saved" }] }), false);
  });
  it("validates frozen proposals without mutation and exposes only guards/constants", () => {
    const frozen = Object.freeze({ ...proposal, items: Object.freeze([Object.freeze({ ...item })]) });
    const before = JSON.stringify(frozen);
    assert.equal(capture.isCaptureProposal(frozen), true);
    assert.equal(JSON.stringify(frozen), before);
    assert.deepEqual(Object.keys(capture).sort(), ["CAPTURE_CONTRACT_VERSION", "isCaptureCommitInput", "isCaptureCommitResult",
      "isCaptureEntityResolution", "isCaptureProposal", "isCaptureProposedItem", "isCaptureRequest", "isCaptureTiming"].sort());
  });
});
