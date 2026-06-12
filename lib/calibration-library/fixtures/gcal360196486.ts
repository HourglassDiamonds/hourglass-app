/** GCAL 8X LG360196486 — live JPG OCR protection anchor (beta pre-launch). */
export const GCAL360196486_REPORT_NUMBER = "LG360196486";

export const GCAL360196486_EXPECTED = {
  reportNumber: GCAL360196486_REPORT_NUMBER,
  shape: "Round Brilliant",
  carat: "1.43",
  measurements: "7.22 - 7.24 x 4.45 mm",
  color: "D",
  clarity: "FL",
  fluorescence: "None",
  tablePercent: "61.5",
  pavilionAngle: "40.8",
  starLengthPercent: "50",
  lowerHalfPercent: "78",
  culet: "None",
  pavilionDepthPercent: "43",
  girdleThicknessPercent: "4.5",
  parserType: "gcal-8x" as const,
  parserConfidence: "high" as const,
  gcal8xTier: "Rare" as const,
};

/** Structured multiline OCR — canonical 8X layout for LG360196486. */
export const GCAL360196486_OCR_MULTILINE = `
GCAL 8X
GEM CERTIFICATION & ASSURANCE
Report ID ${GCAL360196486_REPORT_NUMBER}
GCAL LG360196486 RB 1.43 D FL
Carat Weight
1.43
Color
D
Clarity
FL
Shape and Cutting Style
Round Brilliant
Measurements
7.22 - 7.24 x 4.45 mm
Fluorescence
None
Culet
None
Cut Grade
Excellent
Polish
Excellent
Symmetry
Excellent
Proportion Diagram
Table
57%
Depth
61.5%
Crown Angle
34.5°
Pavilion Angle
40.8°
Star Length
50%
Lower Half
78%
Pavilion Depth
43%
Girdle Thickness
4.5%
`;

/** Live flattened OCR soup — header + 4Cs cluster from Desktop JPG capture. */
export const GCAL360196486_LIVE_OCR_SOUP = `
GEM CERTIFICATION & ASSURANCE LAB
Ultimate Diamond Cut Grade aspects of CUT quality assessment.
LAB GROWN DIAMOND GCAL LG360196486 RB 1.43 D FL
GCAL LG360196486 Scan QR code goto https://www.gcalusa.com/c/360196486
4Cs GRADING Carat Weight 1.43 Color D Clarity FL
Shape and Cutting Style Round Brilliant
Measurements 7.22 - 7.24 x 4.45 mm Fluorescence None Culet None
Cut Grade Excellent Polish Excellent Symmetry Excellent
Proportion Diagram Table 57% Depth 61.5% Crown Angle 34.5 Pavilion Angle 40.8°
Star Length 50% Lower Half 78% Pavilion Depth 43% Girdle Thickness 4.5%
`;
