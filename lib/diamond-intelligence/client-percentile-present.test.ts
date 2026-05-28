import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ESTIMATED_COMPARISON_BAND_CAPTION,
  presentOverallReadLabel,
  presentTraitReadLabel,
} from "./client-percentile-present";

describe("presentOverallReadLabel", () => {
  it("maps overall scores to labels and pills", () => {
    assert.deepEqual(presentOverallReadLabel(99), {
      label: "Top 0.5%",
      showRarePill: true,
      pillText: "Top 0.5%",
    });
    assert.deepEqual(presentOverallReadLabel(95), {
      label: "Top 5%",
      showRarePill: true,
      pillText: "Top 5%",
    });
    assert.deepEqual(presentOverallReadLabel(91), {
      label: "Strong",
      showRarePill: false,
      pillText: null,
    });
    assert.deepEqual(presentOverallReadLabel(87), {
      label: "Balanced",
      showRarePill: false,
      pillText: null,
    });
    assert.deepEqual(presentOverallReadLabel(80), {
      label: "Mixed",
      showRarePill: false,
      pillText: null,
    });
    assert.deepEqual(presentOverallReadLabel(70), {
      label: "Needs review",
      showRarePill: false,
      pillText: null,
    });
  });

  it("does not use corpus or population language in caption", () => {
    assert.doesNotMatch(ESTIMATED_COMPARISON_BAND_CAPTION, /corpus|population|uploaded/i);
  });
});

describe("presentTraitReadLabel coherence", () => {
  const trait = (fillPercent: number) => ({
    label: "Brightness",
    level: "Strong" as const,
    fillPercent,
  });

  it("suppresses Top 1% when overall is below 88", () => {
    const label = presentTraitReadLabel(trait(97), 87);
    assert.equal(label, "Strong");
    assert.doesNotMatch(label, /Top/i);
  });

  it("caps trait 97 to Elite · Top 5% when overall is 88–93", () => {
    const label = presentTraitReadLabel(trait(97), 91);
    assert.equal(label, "Elite · Top 5%");
    assert.doesNotMatch(label, /Top 1%|Top 0\.5%/);
  });

  it("allows Rare · Top 0.5% when overall is 97+", () => {
    assert.equal(presentTraitReadLabel(trait(99), 98), "Rare · Top 0.5%");
  });

  it("does not show Top % below trait score 94", () => {
    const label = presentTraitReadLabel(trait(92), 98);
    assert.equal(label, "Strong");
    assert.doesNotMatch(label, /Top/i);
  });

  it("uses calm diagram language instead of Needs review for scintillation", () => {
    const label = presentTraitReadLabel(
      {
        label: "Scintillation",
        level: "Needs review",
        fillPercent: 0,
      },
      91,
      { needsExpertDiagramReview: true },
    );
    assert.equal(label, "Diagram detail required");
    assert.doesNotMatch(label, /weak|failed|poor/i);
  });
});
