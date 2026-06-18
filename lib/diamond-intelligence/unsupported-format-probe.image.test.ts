import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { GCAL360796191_TEXT_LAYER } from "@/lib/calibration-library/fixtures/gcal360796191";
import { GCAL_SARINE_LG340946327_OCR_TEXT } from "@/lib/calibration-library/fixtures/gcal-sarine-lg340946327";
import {
  looksLikeSparseGcalSarineScreenshotText,
  normalizeGcalProbeOcrText,
  resolveImageUnsupportedFormatProbe,
} from "@/lib/diamond-intelligence/unsupported-format-probe";

/** Live OCR capture — gcal1.jpg / LG360686361 (2026-06-18 validation). */
const GCAL1_HEADER_OCR = `_  Goa—
LAB GROWN DIAMOND PROPORTION DiAGRAM D——
ee fo Tl Tee i
aren 172028 Petes Ero

28 v4 ACs cr "
LASER INSCRIPTION 621mm | 431mm GRADING Clarity VS1`;

const GCAL1_CERT_OCR = `AGRAM Gea by Sane Cette Number "
Lo360686361 2h
TARE`;

/** Live OCR capture — gcal2.jpg / LG360736742 (2026-06-18 validation). */
const GCAL2_HEADER_OCR = `LAB GROWN DIAMOND PROPORTION DIAGRAM Soke Cer my
E— ps, |
Warchat 026 Lh reir

TN 2 ACs cr :
LASER INSCRIPTION 5.80mm | \\M/ jr GRADING Clarity VS1`;

const GCAL2_CERT_OCR = `AGRAM GEA by Sarne Certificate Humber om
Leas0ra6Ta2 2
TERE`;

const STANDARD_GCAL_HEADER_OCR = `
Gem Certification & Assurance Lab
Certificate No. LG352146193
Diamond Grading Analysis
Lab Grown Diamond
Shape Round Brilliant
Physical Symmetry Excellent
Optical Brilliance Excellent
Optical Symmetry Very Good
`;

const GCAL_8X_HEADER_WITHOUT_GCAL_TOKEN = `
Gem Certification & Assurance Lab
Certificate No. LG353306143
Diamond Grading Analysis
`;

const GCAL_8X_CERT_PROBE_OCR =
  "diamonds achieve EXCELLENT grades in all EIGHT Ultimate Diamond Cut Grade\nGCAL LG353306143 RB 3.24 EVVS2";

describe("resolveImageUnsupportedFormatProbe", () => {
  it("does not reject GCAL 8X when header looks like standard DGA but cert has 8X evidence", () => {
    const match = resolveImageUnsupportedFormatProbe({
      headerText: GCAL_8X_HEADER_WITHOUT_GCAL_TOKEN,
      certProbe: {
        detected: true,
        probeText: GCAL_8X_CERT_PROBE_OCR,
      },
    });
    assert.equal(match, null);
  });

  it("defers GCAL 8X when cert probe has certificate line plus 8X layout markers", () => {
    const match = resolveImageUnsupportedFormatProbe({
      headerText: GCAL_8X_HEADER_WITHOUT_GCAL_TOKEN,
      certProbe: {
        detected: false,
        probeText:
          "GCAL LG353306143 RB 3.24 EVVS2\nUltimate Diamond Cut Grade",
      },
    });
    assert.equal(match, null);
  });

  it("rejects standard GCAL image evidence like PDF text-layer classification", () => {
    const match = resolveImageUnsupportedFormatProbe({
      headerText: STANDARD_GCAL_HEADER_OCR,
      certProbe: {
        detected: false,
        probeText: "GCAL LG352146193",
      },
    });
    assert.ok(match);
    assert.equal(match.family, "gcal-standard");
  });

  it("rejects GCAL BY SARINE image header evidence like PDF text layer", () => {
    const match = resolveImageUnsupportedFormatProbe({
      headerText: GCAL360796191_TEXT_LAYER,
      certProbe: { detected: false, probeText: "" },
    });
    assert.ok(match);
    assert.equal(match.family, "gcal-sarine-4cs");
  });

  it("rejects noisy GCAL BY SARINE JPG OCR fixture text", () => {
    const match = resolveImageUnsupportedFormatProbe({
      headerText: GCAL_SARINE_LG340946327_OCR_TEXT,
      certProbe: {
        detected: false,
        probeText: "GCAL LG340946327",
      },
    });
    assert.ok(match);
    assert.equal(match.family, "gcal-sarine-4cs");
  });

  it("uses combined header + cert text before bare cert defer would leak standard GCAL", () => {
    const match = resolveImageUnsupportedFormatProbe({
      headerText: STANDARD_GCAL_HEADER_OCR,
      certProbe: {
        detected: false,
        probeText: "GCAL LG352146193 RB 3.10 E VVS2",
      },
    });
    assert.ok(match);
    assert.equal(match.family, "gcal-standard");
  });

  it("rejects gcal1.jpg live header+cert OCR as Sarine unsupported", () => {
    const match = resolveImageUnsupportedFormatProbe({
      headerText: GCAL1_HEADER_OCR,
      certProbe: { detected: false, probeText: GCAL1_CERT_OCR },
    });
    assert.ok(match);
    assert.equal(match.family, "gcal-sarine-4cs");
  });

  it("rejects gcal2.jpg live header+cert OCR as Sarine unsupported", () => {
    const match = resolveImageUnsupportedFormatProbe({
      headerText: GCAL2_HEADER_OCR,
      certProbe: { detected: false, probeText: GCAL2_CERT_OCR },
    });
    assert.ok(match);
    assert.equal(match.family, "gcal-sarine-4cs");
  });

  it("does not sparse-reject GCAL 8X cert with Ultimate Diamond markers", () => {
    assert.equal(
      looksLikeSparseGcalSarineScreenshotText(GCAL_8X_CERT_PROBE_OCR),
      false,
    );
    const match = resolveImageUnsupportedFormatProbe({
      headerText: GCAL_8X_HEADER_WITHOUT_GCAL_TOKEN,
      certProbe: {
        detected: false,
        probeText: GCAL_8X_CERT_PROBE_OCR,
      },
    });
    assert.equal(match, null);
  });

  it("normalizes GOAL/GEA OCR confusions to GCAL", () => {
    assert.match(normalizeGcalProbeOcrText("GOAL LG360686361"), /GCAL LG360686361/);
    assert.match(normalizeGcalProbeOcrText("GEA by Sarne"), /GCAL by Sarine/);
  });
});

describe("resolveImageUnsupportedFormatProbe standard GCAL fixture text", () => {
  it("matches scripts/_standard-gcal-probe-text.txt classification", () => {
    const text = readFileSync("scripts/_standard-gcal-probe-text.txt", "utf8");
    const match = resolveImageUnsupportedFormatProbe({
      headerText: text,
      certProbe: { detected: false, probeText: "" },
    });
    assert.ok(match);
    assert.equal(match.family, "gcal-standard");
  });
});
