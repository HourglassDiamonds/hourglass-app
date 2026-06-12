/** GCAL BY SARINE JPG OCR — LG340946323 (QA beta pass). */
export const GCAL_SARINE_LG340946323_REPORT_NUMBER = "LG340946323";

export const GCAL_SARINE_LG340946323_OCR_TEXT = `
_ GI —
BY SARINE
GCAL by Sarine Certificate Number
GCAL LG340946323
https://www.gcalusa.com/c/340946323
Carat Weight 1.10
4Cs Color F
GRADI NG Clarity Vs1
Cut Ideal
Shape and Cutting Style Round Brilliant
Measurements 6.62 - 6.66 x 4.06 mm
Table% 58%
Depth% 61.1%
Polish Excellent
Symmetry Excellent
Fluorescence None
Growth Method CVD
`;

export const GCAL_SARINE_LG340946323_EXPECTED = {
  reportNumber: GCAL_SARINE_LG340946323_REPORT_NUMBER,
  parserType: "gcal-sarine-4cs" as const,
  lab: "GCAL" as const,
  color: "F",
  clarity: "VS1",
  cutGrade: "Ideal",
};
