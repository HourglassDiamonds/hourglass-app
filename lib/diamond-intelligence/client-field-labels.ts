import type { ReportFieldKey } from "@/lib/calibration-library/types";

/** Client-safe field labels (no parser / provenance language). */
export const CLIENT_FIELD_LABELS: Record<ReportFieldKey, string> = {
  shape: "Shape",
  carat: "Carat weight",
  measurements: "Measurements",
  tablePercent: "Table %",
  depthPercent: "Depth %",
  crownAngle: "Crown angle",
  pavilionAngle: "Pavilion angle",
  lowerHalfPercent: "Lower-half %",
  starLengthPercent: "Star length %",
  girdle: "Girdle",
  culet: "Culet",
  polish: "Polish",
  symmetry: "Symmetry",
  fluorescence: "Fluorescence",
  cutGrade: "Cut grade",
};

export const CLIENT_FIELD_HINTS: Partial<Record<ReportFieldKey, string>> = {
  tablePercent: "Usually on the proportion diagram.",
  depthPercent: "Usually on the proportion diagram.",
  crownAngle: "Usually on the proportion diagram.",
  pavilionAngle: "Usually on the proportion diagram.",
  lowerHalfPercent: "Often on the diagram for round brilliants.",
  starLengthPercent: "Often on the diagram for round brilliants.",
  girdle: "As printed in the grading results.",
  culet: "As printed in the grading results.",
};
