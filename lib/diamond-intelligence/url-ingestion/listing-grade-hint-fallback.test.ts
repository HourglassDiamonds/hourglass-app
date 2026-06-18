import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import type { ClientSafeInterpretationPayload } from "@/lib/diamond-intelligence/client-api";
import {
  applyListingGradeHintFallback,
  normalizeListingLab,
} from "./listing-grade-hint-fallback";
import type { ListingExtraction } from "./types";

function baseListing(
  overrides: Partial<ListingExtraction> = {},
): ListingExtraction {
  return {
    vendor: "rare-carat",
    url: "https://www.rarecarat.com/diamond/153914979",
    canonicalUrl: "https://www.rarecarat.com/diamond/153914979",
    listingId: "153914979",
    price: 1190,
    currency: "USD",
    shape: "Round",
    carat: 1.27,
    color: "E",
    clarity: "VVS1",
    cut: "Ideal",
    polish: null,
    symmetry: null,
    fluorescence: null,
    lab: "IGI",
    reportNumber: null,
    reportUrl: "https://example.com/cert.png",
    certificateUrl: null,
    imageUrl: null,
    videoUrl: null,
    availability: null,
    extractedAt: new Date().toISOString(),
    extractionConfidence: "high",
    extractionWarnings: [],
    ...overrides,
  };
}

function baseInterpretation(
  overrides: Partial<ClientSafeInterpretationPayload> = {},
): ClientSafeInterpretationPayload {
  return {
    metadata: {
      lab: "IGI",
      reportNumber: "LG772665975",
      stoneType: "lab-grown",
    },
    extractedFields: {
      shape: "Round Brilliant",
      carat: "1.27",
      measurements: "6.98 - 7.01 X 4.25 mm",
      tablePercent: "",
      depthPercent: "",
      crownAngle: "",
      pavilionAngle: "",
      polish: "Excellent",
      symmetry: "Excellent",
      fluorescence: "None",
      cutGrade: "Ideal",
    },
    interpretationFields: {
      shape: "Round Brilliant",
      carat: "1.27",
      measurements: "6.98 - 7.01 X 4.25 mm",
      tablePercent: "",
      depthPercent: "",
      crownAngle: "",
      pavilionAngle: "",
      polish: "Excellent",
      symmetry: "Excellent",
      fluorescence: "None",
      cutGrade: "Ideal",
    },
    capability: {
      canRunClientInterpretation: true,
      interpretationLevel: "partial",
      supportsLevel: "metadata",
      guidedCompletionFields: [
        "tablePercent",
        "depthPercent",
        "crownAngle",
        "pavilionAngle",
      ],
      missingForDeepRead: [],
      missingForProportionRead: [
        "tablePercent",
        "depthPercent",
        "crownAngle",
        "pavilionAngle",
      ],
    },
    gradeHints: { color: "E" },
    ...overrides,
  };
}

describe("normalizeListingLab", () => {
  it("accepts known labs", () => {
    assert.equal(normalizeListingLab("IGI"), "IGI");
    assert.equal(normalizeListingLab("gia"), "GIA");
  });

  it("rejects invalid lab values like label", () => {
    assert.equal(normalizeListingLab("label"), null);
    assert.equal(normalizeListingLab(""), null);
  });
});

describe("applyListingGradeHintFallback", () => {
  it("fills missing clarity from high-confidence listing (153914979 case)", () => {
    const result = applyListingGradeHintFallback(
      baseInterpretation({ gradeHints: { color: "E" } }),
      baseListing(),
    );
    assert.equal(result.gradeHints?.color, "E");
    assert.equal(result.gradeHints?.clarity, "VVS1");
    assert.equal(result.decisionProfile?.gradeHints.clarity, "VVS1");
  });

  it("fills missing color from high-confidence listing", () => {
    const result = applyListingGradeHintFallback(
      baseInterpretation({ gradeHints: { clarity: "VVS1" } }),
      baseListing({ color: "E" }),
    );
    assert.equal(result.gradeHints?.color, "E");
    assert.equal(result.gradeHints?.clarity, "VVS1");
  });

  it("report-derived clarity wins over listing clarity", () => {
    const result = applyListingGradeHintFallback(
      baseInterpretation({ gradeHints: { color: "E", clarity: "VS1" } }),
      baseListing({ clarity: "VVS1" }),
    );
    assert.equal(result.gradeHints?.clarity, "VS1");
  });

  it("report-derived color wins over listing color", () => {
    const result = applyListingGradeHintFallback(
      baseInterpretation({ gradeHints: { color: "G", clarity: "VVS1" } }),
      baseListing({ color: "E" }),
    );
    assert.equal(result.gradeHints?.color, "G");
  });

  it("ignores listing values when extraction confidence is not high", () => {
    const input = baseInterpretation({ gradeHints: { color: "E" } });
    const result = applyListingGradeHintFallback(
      input,
      baseListing({ extractionConfidence: "medium" }),
    );
    assert.equal(result, input);
    assert.equal(result.gradeHints?.clarity, undefined);
  });

  it("does not use invalid listing lab values like label", () => {
    const result = applyListingGradeHintFallback(
      baseInterpretation({
        metadata: { lab: "", reportNumber: "LG1", stoneType: "lab-grown" },
        gradeHints: { color: "E" },
      }),
      baseListing({ lab: "label" }),
    );
    assert.equal(result.metadata.lab, "");
    assert.equal(result.gradeHints?.clarity, "VVS1");
  });

  it("fills empty carat and shape only — not proportions or finish", () => {
    const result = applyListingGradeHintFallback(
      baseInterpretation({
        extractedFields: {
          ...baseInterpretation().extractedFields,
          carat: "",
          shape: "",
          tablePercent: "",
          depthPercent: "",
          polish: "",
          symmetry: "",
          fluorescence: "",
          cutGrade: "",
        },
        interpretationFields: {
          ...baseInterpretation().interpretationFields,
          carat: "",
          shape: "",
        },
        gradeHints: { color: "E" },
      }),
      baseListing({
        carat: 1.27,
        shape: "Round",
        polish: "Excellent",
        symmetry: "Excellent",
        fluorescence: "None",
        cut: "Ideal",
      }),
    );
    assert.equal(result.extractedFields.carat, "1.27");
    assert.equal(result.extractedFields.shape, "Round");
    assert.equal(result.extractedFields.tablePercent, "");
    assert.equal(result.extractedFields.depthPercent, "");
    assert.equal(result.extractedFields.polish, "");
    assert.equal(result.extractedFields.symmetry, "");
    assert.equal(result.extractedFields.fluorescence, "");
    assert.equal(result.extractedFields.cutGrade, "");
  });

  it("does not override report carat or shape when present", () => {
    const result = applyListingGradeHintFallback(
      baseInterpretation({
        extractedFields: {
          ...baseInterpretation().extractedFields,
          carat: "1.01",
          shape: "Oval",
        },
        gradeHints: { color: "E" },
      }),
      baseListing({ carat: 1.27, shape: "Round" }),
    );
    assert.equal(result.extractedFields.carat, "1.01");
    assert.equal(result.extractedFields.shape, "Oval");
    assert.equal(result.gradeHints?.clarity, "VVS1");
  });
});

describe("upload path isolation", () => {
  it("interpret-uploaded-report does not import listing grade hint fallback", async () => {
    const src = await readFile(
      "lib/diamond-intelligence/interpret-uploaded-report.ts",
      "utf8",
    );
    assert.doesNotMatch(src, /listing-grade-hint-fallback/);
  });

  it("ingest-url wires listing grade hint fallback", async () => {
    const src = await readFile(
      "lib/diamond-intelligence/url-ingestion/ingest-url.ts",
      "utf8",
    );
    assert.match(src, /applyListingGradeHintFallback/);
  });

  it("ingest-url wires Rare Carat embedded PDF unwrap", async () => {
    const src = await readFile(
      "lib/diamond-intelligence/url-ingestion/ingest-url.ts",
      "utf8",
    );
    assert.match(src, /resolveRareCaratReportFetchUrl/);
  });
});
