import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuickCapture } from "../../../app/executive-dashboard/concierge/components/quick-capture";
import {
  applyConfirmation,
  captureTimingLabel,
  editReviewItem,
  prepareConfirmation,
  reviewIssue,
  startReview,
} from "../../../app/executive-dashboard/concierge/components/quick-capture-state";
import type { CaptureProposal, CaptureProposedItem } from "./types";

const personId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const mutationId = "33333333-3333-4333-8333-333333333333";

function item(overrides: Partial<CaptureProposedItem> = {}): CaptureProposedItem {
  return {
    itemId: "item-1",
    kind: "action",
    sourceExcerpt: "Call Sam tomorrow",
    title: "Call Sam",
    content: "Call Sam about the design",
    confidence: 0.84,
    timing: { kind: "date-only", originalWording: "tomorrow", date: "2026-09-29" },
    ...overrides,
  };
}

function proposal(items: CaptureProposedItem[]): CaptureProposal {
  return { version: 1, captureId: "capture-1", canonical: false, items };
}

describe("Quick Capture UI", () => {
  it("renders a single capture surface, honest engine state, voice seam, and all manual paths", () => {
    const html = renderToStaticMarkup(createElement(QuickCapture));
    assert.match(html, /Tell Continuum what happened/);
    assert.match(html, /Capture engine connection pending/);
    assert.match(html, /Speak your capture/);
    assert.match(html, /disabled/);
    assert.match(html, /Add manually/);
    for (const label of ["Inbox", "Add action", "Add Note", "Add Client", "My Card"]) {
      assert.match(html, new RegExp(label));
    }
    assert.doesNotMatch(html, /chat|assistant|message bubble/i);
  });

  it("keeps ambiguous and unresolved identities visibly blocked and unselected", () => {
    const rows = startReview(proposal([
      item({ itemId: "ambiguous", entityResolution: { status: "ambiguous", candidates: [
        { kind: "person", id: personId, evidence: "Two existing people are named Sam" },
      ] } }),
      item({ itemId: "unresolved", entityResolution: { status: "unresolved", mention: "Sam" } }),
      item({ itemId: "resolved", entityResolution: { status: "resolved", personId, projectId, evidence: "Existing records matched" } }),
    ]), "capture-1");
    assert.equal(rows[0].selected, false);
    assert.match(reviewIssue(rows[0]) ?? "", /Choose who or which project/);
    assert.equal(rows[1].selected, false);
    assert.match(reviewIssue(rows[1]) ?? "", /not linked/);
    assert.equal(rows[2].selected, true);
    assert.equal(reviewIssue(rows[2]), undefined);
  });

  it("builds one locked-contract confirmation from edited, individually selected items", () => {
    const rows = startReview(proposal([
      item(),
      item({ itemId: "item-2", kind: "note", title: "Preference", content: "Sam prefers platinum" }),
    ]), "capture-1");
    rows[1] = { ...rows[1], selected: false };
    rows[0] = editReviewItem(rows[0], { title: "Call Samuel" });
    const prepared = prepareConfirmation("capture-1", rows, () => mutationId);
    assert.deepEqual(prepared.input.items, [
      { itemId: "item-1", selected: true, mutationId, confirmedItem: { ...rows[0].item, title: "Call Samuel" } },
      { itemId: "item-2", selected: false },
    ]);
    assert.equal(prepared.rows[0].mutationId, mutationId);
  });

  it("never treats incomplete or mismatched writer results as saved", () => {
    const rows = startReview(proposal([item()]), "capture-1");
    const prepared = prepareConfirmation("capture-1", rows, () => mutationId);
    assert.throws(() => applyConfirmation(prepared.rows, prepared.input, {
      version: 1, captureId: "capture-1", items: [],
    }), /Incomplete capture result/);
    const failed = applyConfirmation(prepared.rows, prepared.input, {
      version: 1,
      captureId: "capture-1",
      items: [{ itemId: "item-1", status: "failed", message: "Writer unavailable" }],
    });
    assert.equal(failed[0].selected, true);
    assert.equal(failed[0].result?.status, "failed");
  });

  it("describes timing without claiming unsupported scheduling", () => {
    assert.equal(captureTimingLabel({ kind: "date-only", originalWording: "tomorrow", date: "2026-09-29" }), "September 29, 2026");
    assert.match(captureTimingLabel({
      kind: "checkpoint",
      originalWording: "if they have not replied Friday",
      condition: "No reply received",
    }), /No check time specified/);
    assert.equal(captureTimingLabel(), "No timing specified");
  });
});
