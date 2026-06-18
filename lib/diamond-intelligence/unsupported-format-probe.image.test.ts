import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { GCAL360796191_TEXT_LAYER } from "@/lib/calibration-library/fixtures/gcal360796191";
import { GCAL_SARINE_LG340946327_OCR_TEXT } from "@/lib/calibration-library/fixtures/gcal-sarine-lg340946327";
import {
  hasStrongGcal8xProbeDeferEvidence,
  looksLikeSparseGcalSarineScreenshotText,
  normalizeGcalProbeOcrText,
  resolveImageUnsupportedFormatProbe,
} from "@/lib/diamond-intelligence/unsupported-format-probe";
import { hasStrongGcal8xDeferEvidence } from "@/lib/calibration-library/parsers/gcal/gcal-layout-detector";

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

/** Live cert-band OCR from anchor-pdfs/GCAL-LG353306143.pdf (includes gcalusa QR URL). */
const GCAL_8X_LIVE_CERT_PROBE_OCR = `diamonds achieve EXCELLENT grades in all EIGHT Ultimate Diamond Cut Grade 7
aspects of CUT quality assessment.
GCAL LG353306143 RB 3.24 EVVS2 go EFEE
Scan QR code to view photos and videos of this ty
lab grown diamond, and the 8C grading scale, 4» hr
TAT, Optical Brilliance or go to https://www.gcalusa.com/c/353306143 [a] SmskE:`;

/** Live Sarine cert-band OCR — same marketing panel; probe rejects via sufficient text layer. */
const GCAL_SARINE_LIVE_CERT_PROBE_OCR = `diamonds achieve EXCELLENT grades in all EIGHT Ultimate Diamond Cut Grade /
aspects of CUT quality assessment.
GCAL LG360796192 RB 1.01 D VS1 §C LIE 40]
go to https://www.gcalusa.com/c/360796192`;

const GCAL_8X_HEADER_WITH_SARINE_ACCREDITATION = `
Gem Certification & Assurance Lab
Certificate No. LG353306143
Diamond Grading Analysis
Lab Grown Diamond
GCAL BY SARINE
`;

describe("hasStrongGcal8xDeferEvidence", () => {
  it("accepts LG353306143 cert-band OCR with Ultimate Diamond and EIGHT markers", () => {
    assert.equal(hasStrongGcal8xDeferEvidence(GCAL_8X_CERT_PROBE_OCR), true);
    assert.equal(hasStrongGcal8xProbeDeferEvidence(GCAL_8X_CERT_PROBE_OCR), true);
  });

  it("accepts live LG353306143 cert-band OCR even with gcalusa.com/c/ QR URL", () => {
    assert.equal(hasStrongGcal8xDeferEvidence(GCAL_8X_LIVE_CERT_PROBE_OCR), true);
    assert.equal(hasStrongGcal8xProbeDeferEvidence(GCAL_8X_LIVE_CERT_PROBE_OCR), true);
  });

  it("rejects bare GCAL LG certificate line without 8X layout markers", () => {
    assert.equal(hasStrongGcal8xDeferEvidence("GCAL LG353306143"), false);
    assert.equal(hasStrongGcal8xDeferEvidence("GCAL LG352146193 RB 3.10 E VVS2"), false);
  });

  it("rejects Sarine finish copy that mentions 8X Proportions without Ultimate Diamond", () => {
    assert.equal(
      hasStrongGcal8xDeferEvidence(
        "GCAL BY SARINE\nGCAL LG360796191\n8X Proportions EX Ideal Excellent",
      ),
      false,
    );
  });

  it("recognizes shared Sarine cert-band marketing as strong panel OCR (probe rejects via text layer)", () => {
    assert.equal(hasStrongGcal8xDeferEvidence(GCAL_SARINE_LIVE_CERT_PROBE_OCR), true);
  });
});

describe("resolveImageUnsupportedFormatProbe", () => {
  it("defers true GCAL 8X when header OCR includes GCAL BY SARINE accreditation", () => {
    const match = resolveImageUnsupportedFormatProbe({
      headerText: GCAL_8X_HEADER_WITH_SARINE_ACCREDITATION,
      certProbe: {
        detected: true,
        probeText: GCAL_8X_CERT_PROBE_OCR,
      },
    });
    assert.equal(match, null);
  });

  it("still rejects Sarine when header has GCAL BY SARINE but cert lacks 8X evidence", () => {
    const match = resolveImageUnsupportedFormatProbe({
      headerText: GCAL360796191_TEXT_LAYER,
      certProbe: {
        detected: false,
        probeText: "GCAL LG360796191",
      },
    });
    assert.ok(match);
    assert.equal(match.family, "gcal-sarine-4cs");
  });

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
