/** GCAL BY SARINE JPG OCR — LG353456516 (QA beta pass; clarity line repaired for unit tests). */
export const GCAL_SARINE_LG353456516_REPORT_NUMBER = "LG353456516";

/** Live OCR captures Color D but garbles clarity as "Me"; repaired line reflects report page 1. */
export const GCAL_SARINE_LG353456516_OCR_GARBLED_CLARITY = `
4Cs Color D
Gemprint The fingerprint system for diamonds G RAD N G Clarity Me
Cut Excellent
`;

export const GCAL_SARINE_LG353456516_OCR_TEXT = `
GCAL by Sarine Certificate Number
GCAL LG353456516 Scan QR code to view details of this lab grown diamond
goto https://www.gcalusa.com/c/353456516
Carat Weight 1.01
4Cs Color D
G RAD N G Clarity VS1
Cut Excellent
Shape and Cutting Style Round Brilliant
Table% 57%
Depth% 62.6%
Polish Excellent
Symmetry Very Good
Fluorescence None
Growth Method HPHT
`;

export const GCAL_SARINE_LG353456516_EXPECTED = {
  reportNumber: GCAL_SARINE_LG353456516_REPORT_NUMBER,
  parserType: "gcal-sarine-4cs" as const,
  lab: "GCAL" as const,
  color: "D",
  clarity: "VS1",
  cutGrade: "Excellent",
  tablePercent: "57",
};
