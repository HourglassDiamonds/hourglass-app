/** GCAL BY SARINE 4Cs layout — LG360796191. */
export const GCAL360796191_REPORT_NUMBER = "LG360796191";

export const GCAL360796191_EXPECTED = {
  reportNumber: GCAL360796191_REPORT_NUMBER,
  shape: "Round Brilliant",
  carat: "1.00",
  measurements: "6.43 - 6.46 x 3.94 mm",
  fluorescence: "None",
  girdle: "Medium to Sl. Thick, Faceted",
  culet: "None",
  tablePercent: "57",
  depthPercent: "61.2",
  crownAngle: "34",
  pavilionAngle: "40.8",
  starLengthPercent: "50",
  lowerHalfPercent: "77",
  crownHeightPercent: "14.5",
  pavilionDepthPercent: "43",
  girdleThicknessPercent: "3.6",
  culetSizeMm: "0.4",
  parserType: "gcal-sarine-4cs" as const,
};

/** Pdf text layer — labels column then values column (LG360796191 layout). */
export const GCAL360796191_TEXT_LAYER = `
GCAL BY SARINE
GCAL ${GCAL360796191_REPORT_NUMBER} RB 1.00 D VVS1
4Cs GRADING
Certificate No
Identification
Shape and Cutting Style
Measurements
Fluorescence
Girdle
Culet
Inscription
Growth Method
GCAL ${GCAL360796191_REPORT_NUMBER}
Lab Grown Diamond
Round Brilliant
6.43 - 6.46 x 3.94 mm
GCAL ${GCAL360796191_REPORT_NUMBER}
None
Medium to Sl. Thick, Faceted
None
LAB GROWN DIAMOND
HPHT
`;

/** Inline label/value layout (legacy text-layer variant). */
export const GCAL360796191_TEXT_LAYER_INLINE = `
GCAL BY SARINE
Certificate No GCAL ${GCAL360796191_REPORT_NUMBER}
4Cs GRADING
Shape and Cutting Style Round Brilliant
Measurements 6.43 - 6.46 x 3.94 mm
Carat Weight 1.00
Fluorescence None
Girdle Medium to Sl. Thick, Faceted
Culet None
Growth Method HPHT
`;

/** Collapsed diagram OCR from Sarine proportion crop. */
export const GCAL360796191_DIAGRAM_OCR = `
57% 612% 340° 408° 430% 36% 145% 77% 50% 0.4mm
`;

/** Live PDF diagram crop OCR — lower-half garbled as spaced digits (LG360796191). */
export const GCAL360796191_DIAGRAM_OCR_LIVE_GARBLED = `
6.44mm
340° 3.65mm 57% 50%
0.23mm LRTI 145%
36% ISo~ YY 1 7 7 27 7
3.94mm A 1 277mm
61.2% A) WY, 43.0%
40.8°
`;

/** Finish panel OCR from Sarine right-column crop (LG360796191). */
export const GCAL360796191_FINISH_OCR = `
1. Polish P VG G EX Excellent
2. External Symmetry P VG G EX Excellent
8X Proportions EX Ideal Excellent
`;
