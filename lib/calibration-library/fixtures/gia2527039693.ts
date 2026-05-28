/**
 * Regression fixture — GIA report 2527039693 (natural round brilliant).
 * Diagram order: star % → table % → crown ° → crown height % → pavilion ° → pavilion depth % → lower half %.
 */

export const GIA2527039693_OCR_MULTILINE = `GIA 2527039693
Shape Round Brilliant
Carat Weight 1.90
Measurements 7.84 - 7.88 x 4.96 mm
50%
56%
36.5°
16.5%
40.8°
43.0%
75%
Depth 63.1%
Girdle Medium - Slightly Thick (Faceted) 3.5%
Culet None
Polish Excellent
Symmetry Excellent
Fluorescence Very Strong Blue
Cut Excellent`;

/**
 * PDF text layer: labels and values on separate lines (common GIA upload layout).
 * Matches live extract-file failures where diagram stack regex does not match.
 */
export const GIA2527039693_PDF_TEXT_LAYER = `GIA
2527039693
Shape
Round Brilliant
Carat Weight
1.90
Measurements
7.84 - 7.88 x 4.96 mm
Depth
63.1%
Table
56%
Star Length
50%
Crown Angle
36.5°
Crown Height
16.5%
Pavilion Angle
40.8°
Pavilion Depth
43.0%
Lower Half
75%
Girdle
Medium - Slightly Thick (Faceted)
3.5%
Culet
None
Polish
Excellent
Symmetry
Excellent
Fluorescence
Very Strong Blue
Cut Grade
Excellent`;

/**
 * Live GIA facsimile PDF text layer (uploaded 2527039693) — grading table uses dot
 * leaders; proportion diagram values are not embedded as text (OCR supplies them).
 */
export const GIA2527039693_FACSIMILE_PDF_TEXT = `GIA Report Number   ........................................   2527039693
Shape and Cutting Style   ............................ Round Brilliant
Measurements   ................................ 7.84 - 7.88 x 4.96 mm
Carat Weight   ......................................................... 1.90 carat
Color Grade   ..........................................................................   D
Clarity Grade   ................................................................... VVS2
Cut Grade   ...............................................................   Excellent
Polish   ......................................................................   Excellent
Symmetry   ..............................................................   Excellent
Fluorescence   ........................................... Very Strong Blue
Inscription(s): GIA 2527039693`;

/**
 * Live OCR failure: first "PROPORTIONS" is the report header shell, not the diagram.
 * Diagram values appear later near Crown Angle / grading results.
 */
export const GIA2527039693_WRONG_PROPORTIONS_HEADER = `${GIA2527039693_FACSIMILE_PDF_TEXT}

P R O P O R T I O N S
C L A R I T Y   C H A R A C T E R I S T I C S
G R A D I N G   S C A L E S
A D D I T I O N A L   G R A D I N G   I N F O R M A T I O N
G I A   N A T U R A L   D I A M O N D   G R A D I N G   R E P O R T
FACSIMILE
This is a digital representation of the original GIA Report.
security features are not reproducible on this facsimile.
May 02.2025 GIA
GIA Report Number 2527039693
GRADING RESULTS
Shape and Cutting Style
ROUNd Brilliant
5O%
S6%
Crown Angle
36.5 H
Crown Height
16.5%
Pavilion Angle
40.8 H
Pavilion Depth
43.0%
Measurements 7.84 - 7.88 x 4.96 mm
Depth
63.1%
Lower Half
7S%
Girdle
Medium - Slightly Thick (Faceted)
3.5%
Culet
none
Fluorescence Bive`;

/** Live Tesseract OCR — includes wrong header PROPORTIONS then real diagram block. */
export const GIA2527039693_OCR_TEXT = GIA2527039693_WRONG_PROPORTIONS_HEADER;

const GIA2527039693_OCR_DIAGRAM_BASE = `GIA 2527039693
Shape Round Brilliant
5O%
S6%
Crown Angle
36.5 H
Crown Height
16.5%
Lower Half
7S%
Depth
63.1%
Culet
none`;

/** OCR pavilion angle corruption: O instead of 0. */
export const GIA2527039693_OCR_PAVILION_4O8H = `${GIA2527039693_OCR_DIAGRAM_BASE}
Pavilion Angle
4O.8 H
Pavilion Depth
43.0%
Girdle Medium - Slightly Thick (Faceted) 3.5%`;

/** OCR pavilion angle corruption: comma or space instead of decimal point. */
export const GIA2527039693_OCR_PAVILION_40_8H = `${GIA2527039693_OCR_DIAGRAM_BASE}
Pavilion Angle
40,8 H
Pavilion Depth
43.0%
Girdle
Medium - Slightly Thick
(Faceted)
3.5%`;

/** OCR pavilion angle corruption: B instead of 8. */
export const GIA2527039693_OCR_PAVILION_40BH = `${GIA2527039693_OCR_DIAGRAM_BASE}
Pavilion Angle
40.B H
Pavilion Depth
43.0%
Girdle Medium - Slightly Thick (Faceted) 3.5%`;

/** Split girdle: thickness phrase, Faceted, and % on separate lines with pavilion depth noise. */
export const GIA2527039693_OCR_GIRDLE_SPLIT = `${GIA2527039693_OCR_DIAGRAM_BASE}
Pavilion Angle
40.8 H
Pavilion Depth
43.0%
Girdle
Medium - Slightly Thick
(Faceted)
3.5%`;

/** OCR mis-order: pavilion depth % before pavilion angle degree (must not set angle=43). */
export const GIA2527039693_OCR_PAVILION_DEPTH_BEFORE_ANGLE = `GIA 2527039693
Shape Round Brilliant
5O%
S6%
Crown Angle
36.5 H
Crown Height
16.5%
Pavilion Depth
43.0%
Pavilion Angle
40.8 H
Lower Half
7S%
Depth
63.1%
Girdle
Medium - Slightly Thick (Faceted)
3.5%
Culet
none`;

/** Facsimile grading table + OCR proportion diagram (live extract-file path). */
export const GIA2527039693_FACSIMILE_PLUS_OCR = `${GIA2527039693_FACSIMILE_PDF_TEXT}

50%
56%
36.5°
16.5%
40.8°
43.0%
75%
Depth 63.1%
Girdle Medium - Slightly Thick (Faceted) 3.5%
Culet None`;

/** Inline diagram stack (PDF-style spacing). */
export const GIA2527039693_INLINE_DIAGRAM = `Report 2527039693 GIARound Brilliant
1.90 ct
7.84 - 7.88 x 4.96 mm
50% 56% 36.5° 16.5% 40.8° 43.0% 75%
Total Depth 63.1%
Girdle medium - slightly thick (faceted) 3.5%
Culet none
Polish Excellent
Symmetry Excellent
Fluorescence Very Strong Blue
Cut Grade Excellent`;

export const GIA2527039693_EXPECTED = {
  reportNumber: "2527039693",
  shape: "Round Brilliant",
  carat: "1.90",
  measurements: "7.84 - 7.88 x 4.96 mm",
  tablePercent: "56",
  depthPercent: "63.1",
  crownAngle: "36.5",
  crownHeightPercent: "16.5",
  pavilionAngle: "40.8",
  pavilionDepthPercent: "43",
  lowerHalfPercent: "75",
  starLengthPercent: "50",
  girdle: "Medium - Slightly Thick (Faceted) 3.5%",
  culet: "None",
  polish: "Excellent",
  symmetry: "Excellent",
  fluorescence: "Very Strong Blue",
  cutGrade: "Excellent",
} as const;
