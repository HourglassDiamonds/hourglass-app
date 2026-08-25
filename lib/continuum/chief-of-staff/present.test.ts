import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { presentCommandCenter } from "./present/command-center";
import { renderMorningEmail } from "./present/email";
import type { AttentionItem, ChiefOfStaffBrief } from "./types";

function item(id: string, headline: string): AttentionItem {
  return {
    id,
    dedupeKey: `key:${id}`,
    kind: "founder-action",
    headline,
    whyItMatters: `Why ${headline}`,
    recommendedAction: headline,
    urgency: "today",
    importance: "high",
    audience: "founder-action",
    confidence: "high",
    epistemicClass: "observed",
    observationIds: [],
    evidenceIds: [],
    status: "new",
    createdAt: "2026-08-25T11:00:00.000Z",
    reasonCodes: ["novel"],
  };
}

describe("Chief of Staff app / email same brain", () => {
  it("preserves attention IDs A B C in the same order on both surfaces", () => {
    const items = [
      item("A", "Respond to David before noon"),
      item("B", "Follow up with Charlotte editorial contact today"),
      item("C", "Verify Concierge production health"),
    ];
    const brief: ChiefOfStaffBrief = {
      id: "brief-1",
      localDate: "2026-08-25",
      generatedAt: "2026-08-25T11:00:00.000Z",
      attentionItemIds: ["A", "B", "C"],
      worthKnowing: [],
    };

    const view = presentCommandCenter({ brief, items });
    const email = renderMorningEmail({ brief, items });

    assert.deepEqual(
      view.items.map((row) => row.id),
      ["A", "B", "C"],
    );
    assert.equal(view.status, "active");
    assert.equal(view.heading, "3 things deserve your attention.");

    assert.match(email.text, /1\. Respond to David before noon/);
    assert.match(email.text, /2\. Follow up with Charlotte editorial contact today/);
    assert.match(email.text, /3\. Verify Concierge production health/);
    const first = email.text.indexOf("Respond to David");
    const second = email.text.indexOf("Follow up with Charlotte");
    const third = email.text.indexOf("Verify Concierge");
    assert.ok(first < second && second < third);
    assert.doesNotMatch(email.text, /Watch/i);
  });

  it("does not rerank when item array is shuffled", () => {
    const items = [
      item("C", "Verify Concierge production health"),
      item("A", "Respond to David before noon"),
      item("B", "Follow up with Charlotte editorial contact today"),
    ];
    const brief: ChiefOfStaffBrief = {
      id: "brief-1",
      localDate: "2026-08-25",
      generatedAt: "2026-08-25T11:00:00.000Z",
      attentionItemIds: ["A", "B", "C"],
      worthKnowing: [{ headline: "Sarah's birthday is in 8 days." }],
    };
    const view = presentCommandCenter({ brief, items });
    const email = renderMorningEmail({ brief, items });
    assert.deepEqual(
      view.items.map((row) => row.id),
      ["A", "B", "C"],
    );
    assert.match(email.text, /Sarah's birthday is in 8 days/);
    assert.ok(
      email.text.indexOf("Respond to David") < email.text.indexOf("Verify Concierge"),
    );
  });
});
