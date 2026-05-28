/**
 * Regression fixture — IGI report LG773657228 (lab-grown round brilliant).
 * OCR variants reflect common upload outputs; parser must handle all.
 */

/** Multiline proportion stack with star on its own line. */
export const LG773657228_OCR_MULTILINE = `59%
34.1°
40.8°
43%
14%
Pointed
60.2%
Measurements 8.01 - 8.05 X 4.84 MM
LG773657228
Girdle Medium to Slightly Thick (Faceted)
Polish Excellent
Symmetry Excellent`;

/** Inline diagram without star % — star appears only as a label nearby. */
export const LG773657228_OCR_INLINE_NO_STAR_PCT = `59% 34.1° 40.8° 43% Pointed 60.2%
Star Length 14%
LG773657228
Girdle Medium to Slightly Thick (Faceted) Star Length 14%
Polish Excellent`;

/** Leaky girdle line (common parser trap) — IGI pass must trim to thickness only. */
export const LG773657228_OCR_GIRDLE_LEAK = `LG773657228
59%
34.1°
40.8°
43%
14%
Pointed
60.2%
Girdle Medium to Slightly Thick (Faceted) Star Length 14%`;

/** Duplicate table % before star — must not map 59 into starLengthPercent. */
export const LG773657228_OCR_DUPLICATE_TABLE_PCT = `LG773657228
59%
34.1°
40.8°
43%
59%
14%
Pointed
60.2%
Girdle Medium to Slightly Thick (Faceted)`;

/**
 * PDF text-layer order (star % after culet / depth, not in angle→culet stack).
 * Matches live extract-file failures for LG773657228 uploads.
 */
export const LG773657228_PDF_TEXT_ORDER = `LG773657228
59%
34.1°
40.8°
43%
Pointed
60.2%
Star Length
14%
Measurements 8.01 - 8.05 X 4.84 MM
Girdle Medium to Slightly Thick (Faceted)
Polish Excellent
Symmetry Excellent`;

/** Truncated faceted OCR — must normalize to full (Faceted). */
export const LG773657228_OCR_TRUNCATED_FACETED = `59%
34.1°
40.8°
43%
14%
Pointed
60.2%
LG773657228
Girdle Medium to Slightly Thick (Facete`;

/** Description / header block common on IGI PDF text layer. */
export const LG773657228_HEADER_BLOCK = `IGI
LG773657228
Laboratory Grown
Shape and Cutting Style Round Brilliant
Carat Weight 2.01
Color E
Clarity VVS2
Fluorescence None
`;

export const LG773657228_WITH_HEADER = `${LG773657228_HEADER_BLOCK}
${LG773657228_PDF_TEXT_ORDER}`;

export const LG773657228_EXPECTED = {
  reportNumber: "LG773657228",
  tablePercent: "59",
  crownAngle: "34.1",
  pavilionAngle: "40.8",
  pavilionDepthPercent: "43",
  starLengthPercent: "14",
  lowerHalfPercent: "",
  depthPercent: "60.2",
  culet: "Pointed",
  girdle: "Medium to Slightly Thick (Faceted)",
  measurements: "8.01 - 8.05 x 4.84 mm",
} as const;

export const LG773657228_GRADING_EXPECTED = {
  shape: "Round Brilliant",
  carat: "2.01",
  polish: "Excellent",
  symmetry: "Excellent",
  fluorescence: "None",
} as const;
