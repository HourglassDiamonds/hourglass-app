import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildConciergeHrefFromDiamondIntelligence,
  buildDiamondIntelligenceNotesPrefill,
  conciergeContextFromSearchParams,
  diamondIntelligencePrefillFromSearchParams,
  formatVendorDisplayName,
} from "./diamond-intelligence-context";

describe("buildDiamondIntelligenceNotesPrefill", () => {
  it("builds rich notes from full report context", () => {
    const notes = buildDiamondIntelligenceNotesPrefill({
      sourceLabel: "James Allen",
      sourceUrl: "https://www.jamesallen.com/diamonds/123",
      sourceType: "url",
      lab: "GIA",
      reportNumber: "1234567890",
      carat: "1.02",
      shape: "Round Brilliant",
      color: "G",
      clarity: "VS1",
      cut: "Excellent",
      polish: "Excellent",
      symmetry: "Excellent",
      fluorescence: "None",
      verdict: "Strong Candidate",
    });

    assert.match(notes, /I'd like Justin to review this diamond\./);
    assert.match(notes, /Source:\nJames Allen/);
    assert.match(notes, /URL:\nhttps:\/\/www\.jamesallen\.com\/diamonds\/123/);
    assert.match(notes, /Report:\nGIA 1234567890/);
    assert.match(notes, /Diamond:\n1\.02 ct Round Brilliant/);
    assert.match(notes, /G \/ VS1/);
    assert.match(notes, /Cut: Excellent/);
    assert.match(notes, /Diamond Intelligence result:\nStrong Candidate/);
    assert.doesNotMatch(notes, /Submission ID:/);
  });

  it("includes submission id when provided", () => {
    const notes = buildDiamondIntelligenceNotesPrefill({
      sourceType: "upload",
      sourceLabel: "Uploaded Report",
      submissionId: "abc-123",
    });
    assert.match(notes, /Submission ID:\nabc-123/);
  });

  it("falls back to a simple request when no context is available", () => {
    assert.equal(
      buildDiamondIntelligenceNotesPrefill({}),
      "I'd like Justin to review this diamond.",
    );
  });
});

describe("buildConciergeHrefFromDiamondIntelligence", () => {
  it("encodes concierge context in query params", () => {
    const href = buildConciergeHrefFromDiamondIntelligence({
      lab: "GCAL",
      reportNumber: "LG360196394",
      carat: "1.06",
      shape: "Round Brilliant",
      sourceUrl: "https://www.rarecarat.com/diamond/abc",
      sourceLabel: "Rare Carat",
      sourceType: "url",
      color: "D",
      clarity: "FL",
      verdict: "Worth Reviewing After Additional Information",
    });

    const url = new URL(href, "https://hourglass.test");
    assert.equal(url.pathname, "/concierge");
    assert.equal(url.searchParams.get("source"), "diamond-intelligence");
    assert.equal(url.searchParams.get("lab"), "GCAL");
    assert.equal(url.searchParams.get("report"), "LG360196394");
    assert.equal(url.searchParams.get("carat"), "1.06 ct");
    assert.equal(url.searchParams.get("url"), "https://www.rarecarat.com/diamond/abc");
    assert.equal(url.searchParams.get("vendor"), "Rare Carat");
    assert.equal(url.searchParams.get("stype"), "url");
    assert.equal(url.searchParams.get("verdict"), "Worth Reviewing After Additional Information");
  });
});

describe("diamondIntelligencePrefillFromSearchParams", () => {
  it("round-trips encoded concierge params into notes", () => {
    const href = buildConciergeHrefFromDiamondIntelligence({
      sourceLabel: "Uploaded Report",
      sourceType: "upload",
      lab: "GIA",
      reportNumber: "2141234567",
      carat: "1.50",
      shape: "Round Brilliant",
      color: "F",
      clarity: "VVS2",
      verdict: "Strong Candidate",
    });
    const params = new URL(href, "https://hourglass.test").searchParams;
    const prefill = diamondIntelligencePrefillFromSearchParams(params);
    assert.ok(prefill);
    assert.match(prefill!, /Uploaded Report/);
    assert.match(prefill!, /GIA 2141234567/);
    assert.match(prefill!, /Strong Candidate/);
  });

  it("returns null for non-diamond-intelligence sources", () => {
    const params = new URLSearchParams({ source: "other" });
    assert.equal(diamondIntelligencePrefillFromSearchParams(params), null);
  });
});

describe("conciergeContextFromSearchParams", () => {
  it("parses source type from stype param", () => {
    const params = new URLSearchParams({
      source: "diamond-intelligence",
      stype: "upload",
    });
    assert.equal(conciergeContextFromSearchParams(params)?.sourceType, "upload");
  });
});

describe("formatVendorDisplayName", () => {
  it("formats vendor ids for display", () => {
    assert.equal(formatVendorDisplayName("james-allen"), "James Allen");
    assert.equal(formatVendorDisplayName("unknown"), "Listing");
  });
});
