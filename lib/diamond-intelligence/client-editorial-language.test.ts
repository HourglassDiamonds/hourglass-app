import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  editorialTierFromInternalLabel,
  presentEditorialLightPerformance,
  resolveEditorialFaceUpTier,
  editorialFaceUpSummary,
  editorialLightPerformancePersonality,
} from "./client-editorial-language";

describe("client-editorial-language", () => {
  it("maps internal Top labels to Distinctive", () => {
    assert.equal(
      editorialTierFromInternalLabel("Top 1%", { canShowScore: true }),
      "Distinctive",
    );
    assert.equal(
      editorialTierFromInternalLabel("Top 0.5%", { canShowScore: true }),
      "Distinctive",
    );
  });

  it("maps Mixed to Nuanced and Needs review to Open", () => {
    assert.equal(
      editorialTierFromInternalLabel("Mixed", { canShowScore: true }),
      "Nuanced",
    );
    assert.equal(
      editorialTierFromInternalLabel("Needs review", { canShowScore: true }),
      "Open",
    );
  });

  it("uses Open when score is not shown", () => {
    assert.equal(
      editorialTierFromInternalLabel("Top 1%", { canShowScore: false }),
      "Open",
    );
    assert.equal(
      editorialTierFromInternalLabel("Report read", { canShowScore: false }),
      "Open",
    );
  });

  it("provides a personality descriptor for every tier", () => {
    for (const tier of [
      "Distinctive",
      "Strong",
      "Balanced",
      "Nuanced",
      "Open",
    ] as const) {
      const line = editorialLightPerformancePersonality(tier);
      assert.ok(line.length > 20);
      assert.doesNotMatch(line, /Top %|percentile|corpus/i);
    }
  });

  it("shows Distinctive pill only when rare language is allowed", () => {
    const withRare = presentEditorialLightPerformance({
      internalLabel: "Top 1%",
      displayBand: "Top 1%",
      canShowScore: true,
      canShowRareLanguage: true,
    });
    assert.equal(withRare.tier, "Distinctive");
    assert.equal(withRare.editorialPill, "Distinctive");
    assert.doesNotMatch(withRare.tierLabel, /Top|%/);

    const capped = presentEditorialLightPerformance({
      internalLabel: "Strong",
      displayBand: null,
      canShowScore: true,
      canShowRareLanguage: false,
    });
    assert.equal(capped.tier, "Strong");
    assert.equal(capped.editorialPill, "Strong");
  });

  it("never exposes percentile language in consumer presentation", () => {
    const pres = presentEditorialLightPerformance({
      internalLabel: "Top 0.5%",
      displayBand: "Top 0.5%",
      canShowScore: true,
      canShowRareLanguage: true,
    });
    const combined = `${pres.tierLabel} ${pres.personalityDescriptor} ${pres.editorialPill ?? ""} ${pres.graphCenterLabel}`;
    assert.doesNotMatch(combined, /Top %|Top 0|percentile|Exceptional|Rare|Elite/i);
  });

  it("shows Needs Review instead of Open on consumer tier labels", () => {
    const pres = presentEditorialLightPerformance({
      internalLabel: "Report read",
      displayBand: null,
      canShowScore: false,
      canShowRareLanguage: false,
    });
    assert.equal(pres.tier, "Open");
    assert.equal(pres.tierLabel, "Needs Review");
    assert.equal(pres.graphCenterLabel, "Needs Review");
  });

  it("resolves five face-up tiers from spread ratio", () => {
    assert.equal(resolveEditorialFaceUpTier(1.06), "Expansive Presence");
    assert.equal(resolveEditorialFaceUpTier(1.04), "Generous Presence");
    assert.equal(resolveEditorialFaceUpTier(1.01), "Balanced Presence");
    assert.equal(resolveEditorialFaceUpTier(0.98), "Focused Presence");
    assert.equal(resolveEditorialFaceUpTier(0.95), "Compact Presence");
  });

  it("face-up summaries avoid percentile language", () => {
    for (const tier of [
      "Expansive Presence",
      "Generous Presence",
      "Balanced Presence",
      "Compact Presence",
      "Focused Presence",
    ] as const) {
      assert.doesNotMatch(editorialFaceUpSummary(tier), /Top %|percentile/i);
    }
  });
});
