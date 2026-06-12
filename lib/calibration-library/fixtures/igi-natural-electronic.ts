/**
 * IGI natural round brilliant Electronic Copy — PDF text-layer fixtures.
 * Proportion blocks include star % + table % before crown ° (GIA-stack shape)
 * which must not misroute to gia-modern.
 */

function igiNaturalElectronicCopy(spec: {
  reportNumber: string;
  carat: string;
  color: string;
  clarity: string;
  cut: string;
  polish: string;
  symmetry: string;
  fluorescence: string;
  table: string;
  crown: string;
  pavilion: string;
  depth: string;
  star?: string;
  measurements?: string;
}): string {
  const star = spec.star ?? "50";
  const measurements =
    spec.measurements ?? "7.40 - 7.44 x 4.62 mm";
  return `
IGI
International Gemological Institute
IGI Report Number ${spec.reportNumber}
ELECTRONIC COPY
Description NATURAL DIAMOND
Shape and Cutting Style Round Brilliant
Measurements ${measurements}
GRADING RESULTS
Carat Weight ${spec.carat} carat
Color Grade ${spec.color}
Clarity Grade ${spec.clarity}
Cut Grade ${spec.cut}
Polish ${spec.polish}
Symmetry ${spec.symmetry}
Fluorescence ${spec.fluorescence}
PROPORTIONS
${star}%
${spec.table}%
${spec.crown}°
${spec.pavilion}°
43.0%
14.0%
Pointed
${spec.depth}%
Girdle Medium to Slightly Thick (Faceted)
Culet Pointed
`;
}

export const IGI720512619_TEXT = igiNaturalElectronicCopy({
  reportNumber: "720512619",
  carat: "1.52",
  color: "E",
  clarity: "I 2",
  cut: "FAIR",
  polish: "VERY GOOD",
  symmetry: "GOOD",
  fluorescence: "STRONG",
  table: "59",
  crown: "34.1",
  pavilion: "40.8",
  depth: "61.7",
});

export const IGI798614944_TEXT = igiNaturalElectronicCopy({
  reportNumber: "798614944",
  carat: "1.01",
  color: "D",
  clarity: "I 1",
  cut: "EXCELLENT",
  polish: "EXCELLENT",
  symmetry: "EXCELLENT",
  fluorescence: "STRONG",
  table: "57",
  crown: "34.5",
  pavilion: "40.8",
  depth: "61.5",
  measurements: "6.48 - 6.52 x 4.01 mm",
});

export const IGI629451327_TEXT = igiNaturalElectronicCopy({
  reportNumber: "629451327",
  carat: "0.90",
  color: "F",
  clarity: "I1",
  cut: "GOOD",
  polish: "EXCELLENT",
  symmetry: "VERY GOOD",
  fluorescence: "VERY SLIGHT",
  table: "58",
  crown: "34.0",
  pavilion: "41.0",
  depth: "60.8",
  measurements: "6.20 - 6.24 x 3.78 mm",
});

export const IGI720512619_EXPECTED = {
  reportNumber: "720512619",
  color: "E",
  clarity: "I2",
  cutGrade: "Fair",
  polish: "Very Good",
  symmetry: "Good",
  fluorescence: "Strong",
  tablePercent: "59",
  depthPercent: "61.7",
  crownAngle: "34.1",
  pavilionAngle: "40.8",
  recommendation: "Not Recommended" as const,
};

export const IGI798614944_EXPECTED = {
  reportNumber: "798614944",
  color: "D",
  clarity: "I1",
  cutGrade: "Excellent",
  polish: "Excellent",
  symmetry: "Excellent",
  fluorescence: "Strong",
  tablePercent: "57",
  depthPercent: "61.5",
  crownAngle: "34.5",
  pavilionAngle: "40.8",
  recommendation: "Not Recommended" as const,
};

export const IGI629451327_EXPECTED = {
  reportNumber: "629451327",
  color: "F",
  clarity: "I1",
  cutGrade: "Good",
  polish: "Excellent",
  symmetry: "Very Good",
  fluorescence: "Very Slight",
  tablePercent: "58",
  depthPercent: "60.8",
  crownAngle: "34",
  pavilionAngle: "41",
  recommendation: "Not Recommended" as const,
};
