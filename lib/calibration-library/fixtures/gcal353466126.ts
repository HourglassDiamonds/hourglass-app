/** GCAL 8X LG353466126 — OCR layout with marketing copy that must not bleed into fields. */
export const GCAL353466126_REPORT_NUMBER = "LG353466126";

export const GCAL353466126_EXPECTED = {
  reportNumber: GCAL353466126_REPORT_NUMBER,
  shape: "Round Brilliant",
  carat: "1.91",
  measurements: "7.98 - 8.01 x 4.88 mm",
  fluorescence: "None",
  tablePercent: "58",
  depthPercent: "61.1",
  crownAngle: "34.5",
  pavilionAngle: "40.8",
  starLengthPercent: "48",
  lowerHalfPercent: "77",
  girdle: "Medium, Faceted",
  polish: "Excellent",
  symmetry: "Excellent",
  cutGrade: "Excellent",
  culet: "None",
  crownHeightPercent: "14.5",
  pavilionDepthPercent: "43",
  girdleThicknessPercent: "3.5",
  culetSizeMm: "0.3",
  parserType: "gcal-8x" as const,
  parserConfidence: "high" as const,
};

export const GCAL353466126_OCR_MULTILINE = `
GCAL 8X
GEM CERTIFICATION & ASSURANCE
Report ID ${GCAL353466126_REPORT_NUMBER}
GCAL LG353466126 RB 1.91 E VVS2
Carat Weight
1.91
Color
E
Clarity
VS1
Shape and Cutting Style
Round Brilliant
Measurements
7.98 - 8.01 x 4.88 mm
Fluorescence
None
Girdle
Medium, Faceted
Culet
None
Inscription
LAB GROWN ${GCAL353466126_REPORT_NUMBER}
Growth Method
CVD
Cut Grade
Excellent
Polish
Excellent
Symmetry
Excellent
Proportion Diagram
Table
58%
Depth
61.1%
Crown Angle
34.5 H
Crown Height
14.5%
Pavilion Angle
4O.8 H
Pavilion Depth
43.0%
Star Length
48%
Lower Half
77%
Girdle Thickness
3.5%
Culet Size
0.3mm
The Ultimate Diamond Grading Report
fingerprint of your lab grown lot
Inscription LAB GROWN ${GCAL353466126_REPORT_NUMBER}
GEM CERTIFICATION & ASSURAN
Grade
Polish
fingerprint of your lab grown lot
Symmetry
Inscription LAB GROWN...
Cut Grade
GEM CERTIFICATION & ASSURAN
`;

/** Collapsed diagram OCR from image-region crop (missing decimal separators). */
export const GCAL353466126_COLLAPSED_DIAGRAM_OCR = `
Proportion Diagram
7.99mm 4.60mm 58% 48% 345° 408° 611% 145mm 430mm 77% 35mm 147mm 0.02mm 0.3mm
Measurements 7.98-8.01 x 4 88mm
`;

/**
 * Live OCR soup (flattened marketing + grading islands + diagram numerics).
 * Fragment derived from server [GCAL WINDOW CHECK] on LG353466126 upload.
 */
export const GCAL353466126_LIVE_OCR_SOUP = `
GCAL LG353466126 RB 1.91 E VVS2 ultimate achievement in precision diamond
GEM CERTIFICATION & ASSURANCE LAB fingerprint system for diamonds
Carat Weight 1.91 premiums. Register your diamond at GEMPRINT.com
Color E Clarity VVS2 Fire Poor Fair Good Very Good Excellent
Shape and Cutting Style Round Brilliant scintillation produced when light travels
Measurements 7.98-8.01 x 4.88mm Fluorescence None Girdle Medium Faceted Culet None
Lab Grown Diamond GCAL LG353466126 Proportion Diagram
7.99mm 4.60mm 58% 48% 34.5° 40.8° 61.1% 14.5% 43% 77% 3.5% 0.02mm 0.3mm
Cut Grade Excellent Polish Excellent Symmetry Excellent
fingerprint of your lab grown lot GEM CERTIFICATION & ASSURAN
`;

/** Generic OCR path would wrongly match marketing — must stay on gcal-8x parser. */
/** Flat screenshot OCR — collapsed decimals, no Proportion Diagram heading. */
export const GCAL353466126_SCREENSHOT_OCR = `
GCAL 8X GEM CERTIFICATION & ASSURANCE
GCAL LG353466126 RB 191 E VVS2
Shape and Cutting Style Round Brilliant
Measurements 798-801x488 mm
Fluorescence None
Girdle Medium Faceted
Culet None
Table 58
Depth 611
Crown Angle 345
Pavilion Angle 108 408
Star Length 48
Lower Half 77
Polish Excellent
Symmetry Excellent
Cut Grade Excellent
`;

export const GCAL353466126_MARKETING_TRAP = `
GCAL 8X
Report ${GCAL353466126_REPORT_NUMBER}
GCAL LG353466126 RB 1.91
Carat Weight 1.91
Shape and Cutting Style
Round Brilliant
Measurements 7.98 - 8.01 x 4.88 mm
Fluorescence None
Girdle Medium, Faceted
Culet None
Proportion Diagram
Table 58%
Depth 61.1%
Crown Angle 34.5°
Crown Height 14.5%
Pavilion Angle 40.8°
Pavilion Depth 43.0%
Star Length 48%
Lower Half 77%
Girdle Thickness 3.5%
Culet Size 0.3mm
Cut Grade Excellent
Polish Excellent
Symmetry Excellent
GEM CERTIFICATION & ASSURAN
Polish
fingerprint of your lab grown lot
Symmetry
Inscription LAB GROWN ${GCAL353466126_REPORT_NUMBER}
Shape
Grade
`;
