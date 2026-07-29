import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONCIERGE_CTA_LABEL,
  CONCIERGE_FORM_FIELD_NAMES,
  CONCIERGE_OPTION_VALUES,
  CONCIERGE_VISIBLE_COPY,
  buildConciergeSummary,
  contextualReassuranceForSelection,
} from "./conversational-copy";

describe("CONCIERGE_FORM_FIELD_NAMES", () => {
  it("keeps stable submission field names", () => {
    assert.equal(CONCIERGE_FORM_FIELD_NAMES.projectType, "projectType");
    assert.equal(CONCIERGE_FORM_FIELD_NAMES.shapeInterest, "shapeInterest");
    assert.equal(CONCIERGE_FORM_FIELD_NAMES.designDirection, "designDirection");
    assert.equal(CONCIERGE_FORM_FIELD_NAMES.ringPresence, "ringPresence");
    assert.equal(CONCIERGE_FORM_FIELD_NAMES.timeline, "timeline");
    assert.equal(CONCIERGE_FORM_FIELD_NAMES.budgetRange, "budgetRange");
    assert.equal(
      CONCIERGE_FORM_FIELD_NAMES.preferredContactMethod,
      "preferredContactMethod",
    );
    assert.equal(CONCIERGE_FORM_FIELD_NAMES.inspirationNotes, "inspirationNotes");
  });
});

describe("CONCIERGE_OPTION_VALUES", () => {
  it("preserves project type option values", () => {
    assert.deepEqual([...CONCIERGE_OPTION_VALUES.projectTypes], [
      "Engagement Ring",
      "Custom Jewelry",
      "Wedding Band",
      "Still Exploring",
    ]);
  });

  it("preserves shape, direction, presence, timeline, and budget values", () => {
    assert.ok(CONCIERGE_OPTION_VALUES.shapes.includes("Not Sure Yet"));
    assert.ok(CONCIERGE_OPTION_VALUES.directions.includes("Quiet Elegance"));
    assert.ok(CONCIERGE_OPTION_VALUES.directions.includes("Still Discovering"));
    assert.ok(CONCIERGE_OPTION_VALUES.presences.includes("Still Exploring"));
    assert.deepEqual([...CONCIERGE_OPTION_VALUES.timelines], [
      "0–2 months",
      "3–4 months",
      "6+ months",
      "Flexible",
    ]);
    assert.ok(CONCIERGE_OPTION_VALUES.budgets.includes("Prefer to Discuss"));
    assert.ok(CONCIERGE_OPTION_VALUES.budgets.includes("Under 10k"));
  });
});

describe("CONCIERGE_VISIBLE_COPY", () => {
  it("uses conversational visible prompts", () => {
    assert.equal(
      CONCIERGE_VISIBLE_COPY.opening.projectType,
      "What brings you here today?",
    );
    assert.equal(
      CONCIERGE_VISIBLE_COPY.opening.shapeInterest,
      "Have you started gravitating toward a particular shape?",
    );
    assert.equal(
      CONCIERGE_VISIBLE_COPY.design.designDirection,
      "When you picture the finished piece, what feels most natural?",
    );
    assert.equal(
      CONCIERGE_VISIBLE_COPY.design.ringPresence,
      "How do you imagine it catching the eye?",
    );
    assert.equal(CONCIERGE_VISIBLE_COPY.design.summaryLabel, "So Far");
    assert.equal(
      CONCIERGE_VISIBLE_COPY.practical.timeline,
      "Is there a date you are working toward?",
    );
    assert.equal(
      CONCIERGE_VISIBLE_COPY.practical.budget,
      "Do you already have an investment range in mind?",
    );
    assert.equal(
      CONCIERGE_VISIBLE_COPY.practical.notes,
      "Tell us anything you would like Justin to know.",
    );
    assert.equal(
      CONCIERGE_VISIBLE_COPY.practical.contact,
      "How should Justin reach you?",
    );
  });

  it("keeps only the retained bottom reassurance sentence", () => {
    assert.equal(
      CONCIERGE_VISIBLE_COPY.closing.primary,
      "You do not need to have everything figured out. This is simply a starting point.",
    );
    assert.equal(
      "secondary" in CONCIERGE_VISIBLE_COPY.closing,
      false,
    );
    assert.doesNotMatch(
      JSON.stringify(CONCIERGE_VISIBLE_COPY.closing),
      /We will take it from here together/,
    );
  });

  it("keeps the Begin the Conversation CTA label", () => {
    assert.equal(CONCIERGE_CTA_LABEL, "Begin the Conversation");
  });
});

describe("buildConciergeSummary", () => {
  it("uses the uncertain state when design direction and presence are open", () => {
    const summary = buildConciergeSummary({
      projectType: "Still Exploring",
      shape: "Not Sure Yet",
      direction: "Still Discovering",
      presence: "Still Exploring",
    });
    assert.equal(
      summary.heading,
      "You’re still exploring—and that is completely fine.",
    );
    assert.match(summary.body, /locks you|Justin/i);
  });

  it("stays uncertain when only project or shape is chosen", () => {
    const withProject = buildConciergeSummary({
      projectType: "Engagement Ring",
      shape: "Oval",
      direction: "Still Discovering",
      presence: "Still Exploring",
    });
    assert.equal(
      withProject.heading,
      "You’re still exploring—and that is completely fine.",
    );
  });

  it("reflects design direction only", () => {
    const summary = buildConciergeSummary({
      projectType: "Still Exploring",
      shape: "Not Sure Yet",
      direction: "Modern Minimal",
      presence: "Still Exploring",
    });
    assert.equal(summary.heading, "You seem drawn toward quiet, modern design.");
    assert.match(summary.body, /Justin a useful starting point/);
    assert.doesNotMatch(summary.heading, /presence/i);
  });

  it("reflects ring presence only", () => {
    const summary = buildConciergeSummary({
      projectType: "Still Exploring",
      shape: "Not Sure Yet",
      direction: "Still Discovering",
      presence: "Understated",
    });
    assert.equal(
      summary.heading,
      "You seem drawn toward a more understated presence.",
    );
    assert.doesNotMatch(summary.heading, /design/i);
  });

  it("reflects both design direction and ring presence", () => {
    const summary = buildConciergeSummary({
      projectType: "Engagement Ring",
      shape: "Oval",
      direction: "Classic Timeless",
      presence: "Balanced",
    });
    assert.equal(
      summary.heading,
      "You seem drawn toward a quiet, classic design with a balanced presence.",
    );
    assert.equal(
      summary.body,
      "That gives Justin a useful starting point. Shape, proportions, and final details can be refined together.",
    );
  });

  it("avoids awkward duplicated descriptor phrasing", () => {
    const classic = buildConciergeSummary({
      projectType: "Custom Jewelry",
      shape: "Round",
      direction: "Classic Timeless",
      presence: "Still Exploring",
    });
    assert.doesNotMatch(classic.heading, /classic,? timeless/i);
    assert.doesNotMatch(classic.heading, /timeless design/i);

    const bold = buildConciergeSummary({
      projectType: "Custom Jewelry",
      shape: "Round",
      direction: "Bold Presence",
      presence: "Statement",
    });
    assert.equal(
      bold.heading,
      "You seem drawn toward a bold design with a statement presence.",
    );
    assert.doesNotMatch(bold.heading, /bold presence design/i);
  });

  it("never sounds diagnostic", () => {
    const summary = buildConciergeSummary({
      projectType: "Engagement Ring",
      shape: "Oval",
      direction: "Quiet Elegance",
      presence: "Understated",
    });
    assert.match(summary.heading, /seem drawn toward/i);
    assert.doesNotMatch(summary.heading, /you are a|your style is|matched|identified/i);
  });
});

describe("contextualReassuranceForSelection", () => {
  it("returns subtle reassurance for low-pressure choices only", () => {
    assert.equal(
      contextualReassuranceForSelection("projectType", "Still Exploring"),
      CONCIERGE_VISIBLE_COPY.contextual.stillExploring,
    );
    assert.equal(
      contextualReassuranceForSelection("shape", "Not Sure Yet"),
      CONCIERGE_VISIBLE_COPY.contextual.notSureYet,
    );
    assert.equal(
      contextualReassuranceForSelection("budget", "Prefer to Discuss"),
      CONCIERGE_VISIBLE_COPY.contextual.preferToDiscuss,
    );
    assert.equal(
      contextualReassuranceForSelection("projectType", "Engagement Ring"),
      null,
    );
    assert.equal(contextualReassuranceForSelection("shape", "Oval"), null);
    assert.equal(contextualReassuranceForSelection("budget", "10–20k"), null);
  });
});
