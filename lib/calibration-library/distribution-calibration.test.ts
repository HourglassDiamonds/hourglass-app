import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDistributionHistogram,
  deriveDatasetHealthNotes,
} from "./distribution-calibration";
import type { ScoreDistribution } from "./light-performance-calibration-review";

test("histogram buckets cover scored values", () => {
  const hist = buildDistributionHistogram([6.2, 7.8, 9.1, 10]);
  const total = hist.reduce((a, b) => a + b.count, 0);
  assert.equal(total, 4);
});

test("dataset health notes flag top-heavy curated set", () => {
  const distribution: ScoreDistribution = {
    scoreReadyCount: 20,
    scoredEligibleCount: 20,
    min: 8.3,
    max: 10,
    average: 9.35,
    byBand: [
      { bandId: "exceptional", label: "Exceptional / Rare", count: 15 },
      { bandId: "superb", label: "Superb", count: 5 },
      { bandId: "strong", label: "Strong", count: 0 },
      { bandId: "balanced", label: "Balanced", count: 0 },
      { bandId: "mixed", label: "Mixed", count: 0 },
      { bandId: "compromise", label: "Significant Compromise", count: 0 },
    ],
  };
  const notes = deriveDatasetHealthNotes({
    distribution,
    reviews: [],
    rows: [],
  });
  assert.ok(notes.some((n) => n.includes("top-heavy")));
  assert.ok(notes.some((n) => n.includes("commercial-average")));
});
