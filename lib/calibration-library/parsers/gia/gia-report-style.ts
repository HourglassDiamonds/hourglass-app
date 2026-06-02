/**
 * GIA report-family detection and style-specific diagram band definitions.
 * Diagram-first extraction routes by style — not one generic GIA OCR path.
 */
import type { ReportFieldKey } from "../../types";

export type GiaReportStyle =
  | "GIA_LGDR_DOSSIER"
  | "GIA_NATURAL_FACSIMILE"
  | "GIA_NATURAL_COLORED_SIMPLIFIED"
  | "GIA_UNKNOWN";

/** Legacy layout id used by diagram renderer (maps 1:1 with report style). */
export type GiaDiagramLayout =
  | "lgdr-dossier"
  | "facsimile"
  | "colored-simplified";

export type CropRegion = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type GiaDiagramBandDef = {
  id: string;
  crop: CropRegion;
  expects: ReportFieldKey[];
  preprocess: "raw" | "contrast" | "threshold";
  scale: number;
};

export type GiaReportStyleDetection = {
  style: GiaReportStyle;
  layout: GiaDiagramLayout;
  signals: string[];
};

export const GIA_PROPORTION_DIAGRAM_REGION: CropRegion = {
  left: 0.5,
  top: 0.2,
  width: 0.48,
  height: 0.44,
};

export const GIA_LGDR_DOSSIER_DIAGRAM_REGION: CropRegion = {
  left: 0.48,
  top: 0.11,
  width: 0.5,
  height: 0.38,
};

export const GIA_COLORED_SIMPLIFIED_DIAGRAM_REGION: CropRegion = {
  left: 0.05,
  top: 0.4,
  width: 0.45,
  height: 0.18,
};

const HEADER_BAND: GiaDiagramBandDef = {
  id: "header",
  crop: { left: 0.48, top: 0.115, width: 0.5, height: 0.075 },
  expects: ["tablePercent", "starLengthPercent", "crownAngle"],
  preprocess: "threshold",
  scale: 6,
};

/** LGDR dossier header — taller crop to include crown-angle row (forensics). */
const LGDR_HEADER_BAND: GiaDiagramBandDef = {
  id: "header",
  crop: { left: 0.48, top: 0.105, width: 0.52, height: 0.095 },
  expects: ["tablePercent", "starLengthPercent", "crownAngle"],
  preprocess: "threshold",
  scale: 6,
};

/** LGDR crown-angle row between table % and crown-height % (diagram stack). */
const LGDR_CROWN_ANGLE_BAND: GiaDiagramBandDef = {
  id: "crown-angle",
  crop: { left: 0.5, top: 0.168, width: 0.48, height: 0.045 },
  expects: ["crownAngle"],
  preprocess: "threshold",
  scale: 6,
};

/** LGDR / dossier — upper-right profile stack (forensics-calibrated). */
export const GIA_LGDR_DOSSIER_DIAGRAM_BANDS: GiaDiagramBandDef[] = [
  LGDR_HEADER_BAND,
  {
    id: "stack",
    crop: { left: 0.5, top: 0.19, width: 0.48, height: 0.09 },
    expects: [
      "depthPercent",
      "pavilionAngle",
      "lowerHalfPercent",
      "starLengthPercent",
    ],
    preprocess: "threshold",
    scale: 6,
  },
  LGDR_CROWN_ANGLE_BAND,
  {
    id: "crown",
    crop: { left: 0.5, top: 0.2, width: 0.48, height: 0.08 },
    expects: ["crownAngle", "pavilionAngle"],
    preprocess: "threshold",
    scale: 6,
  },
  {
    id: "girdle",
    crop: { left: 0.5, top: 0.28, width: 0.48, height: 0.05 },
    expects: ["girdle"],
    preprocess: "contrast",
    scale: 6,
  },
  {
    id: "pavilion",
    crop: { left: 0.5, top: 0.27, width: 0.48, height: 0.1 },
    expects: ["pavilionAngle", "lowerHalfPercent"],
    preprocess: "threshold",
    scale: 6,
  },
  {
    id: "culet-depth",
    crop: { left: 0.5, top: 0.27, width: 0.48, height: 0.12 },
    expects: ["depthPercent", "culet"],
    preprocess: "contrast",
    scale: 6,
  },
];

/** Natural diamond facsimile — center/upper diagram with grading scales. */
export const GIA_NATURAL_FACSIMILE_DIAGRAM_BANDS: GiaDiagramBandDef[] = [
  HEADER_BAND,
  {
    id: "table",
    crop: { left: 0.5, top: 0.19, width: 0.48, height: 0.06 },
    expects: ["tablePercent", "depthPercent"],
    preprocess: "threshold",
    scale: 6,
  },
  {
    id: "crown",
    crop: { left: 0.5, top: 0.2, width: 0.48, height: 0.08 },
    expects: ["crownAngle", "starLengthPercent"],
    preprocess: "threshold",
    scale: 6,
  },
  {
    id: "girdle",
    crop: { left: 0.5, top: 0.28, width: 0.48, height: 0.05 },
    expects: ["girdle"],
    preprocess: "contrast",
    scale: 6,
  },
  {
    id: "pavilion",
    crop: { left: 0.5, top: 0.27, width: 0.48, height: 0.1 },
    expects: ["pavilionAngle", "lowerHalfPercent"],
    preprocess: "threshold",
    scale: 6,
  },
  {
    id: "culet-depth",
    crop: { left: 0.5, top: 0.27, width: 0.48, height: 0.12 },
    expects: ["depthPercent", "culet"],
    preprocess: "contrast",
    scale: 6,
  },
];

/** Natural colored — simplified proportions graphic; angles often absent. */
export const GIA_NATURAL_COLORED_SIMPLIFIED_BANDS: GiaDiagramBandDef[] = [
  {
    id: "proportions-header",
    crop: { left: 0.05, top: 0.43, width: 0.38, height: 0.05 },
    expects: ["tablePercent"],
    preprocess: "threshold",
    scale: 5,
  },
  {
    id: "proportions-stack",
    crop: { left: 0.05, top: 0.47, width: 0.38, height: 0.07 },
    expects: ["depthPercent"],
    preprocess: "threshold",
    scale: 5,
  },
  {
    id: "girdle",
    crop: { left: 0.05, top: 0.5, width: 0.38, height: 0.05 },
    expects: ["girdle"],
    preprocess: "contrast",
    scale: 6,
  },
  {
    id: "culet",
    crop: { left: 0.05, top: 0.52, width: 0.38, height: 0.06 },
    expects: ["culet"],
    preprocess: "contrast",
    scale: 6,
  },
];

export function layoutForStyle(style: GiaReportStyle): GiaDiagramLayout {
  switch (style) {
    case "GIA_LGDR_DOSSIER":
      return "lgdr-dossier";
    case "GIA_NATURAL_COLORED_SIMPLIFIED":
      return "colored-simplified";
    case "GIA_NATURAL_FACSIMILE":
    default:
      return "facsimile";
  }
}

export function styleFromLayout(layout: GiaDiagramLayout): GiaReportStyle {
  switch (layout) {
    case "lgdr-dossier":
      return "GIA_LGDR_DOSSIER";
    case "colored-simplified":
      return "GIA_NATURAL_COLORED_SIMPLIFIED";
    default:
      return "GIA_NATURAL_FACSIMILE";
  }
}

export function bandsForStyle(style: GiaReportStyle): GiaDiagramBandDef[] {
  switch (style) {
    case "GIA_LGDR_DOSSIER":
      return GIA_LGDR_DOSSIER_DIAGRAM_BANDS;
    case "GIA_NATURAL_COLORED_SIMPLIFIED":
      return GIA_NATURAL_COLORED_SIMPLIFIED_BANDS;
    case "GIA_NATURAL_FACSIMILE":
      return GIA_NATURAL_FACSIMILE_DIAGRAM_BANDS;
    default:
      return GIA_NATURAL_FACSIMILE_DIAGRAM_BANDS;
  }
}

export function regionForStyle(style: GiaReportStyle): CropRegion {
  switch (style) {
    case "GIA_LGDR_DOSSIER":
      return GIA_LGDR_DOSSIER_DIAGRAM_REGION;
    case "GIA_NATURAL_COLORED_SIMPLIFIED":
      return GIA_COLORED_SIMPLIFIED_DIAGRAM_REGION;
    default:
      return GIA_PROPORTION_DIAGRAM_REGION;
  }
}

/** Whether crown/pavilion angles are expected on this report style. */
export function styleExpectsFullAngles(style: GiaReportStyle): boolean {
  return style !== "GIA_NATURAL_COLORED_SIMPLIFIED";
}

/**
 * Classify GIA PDF text into a diagram extraction route.
 * Uses text-layer signals only — diagram values come from band OCR.
 */
export function detectGiaReportStyle(combinedText: string): GiaReportStyleDetection {
  const t = combinedText.slice(0, 12000);
  const signals: string[] = [];

  if (
    /\bLGDR\b/i.test(t) ||
    /laboratory[-\s]*grown\s+diamond\s+report[\s\S]{0,200}dossier/i.test(t)
  ) {
    if (/\bLGDR\b/i.test(t)) signals.push("LGDR token");
    if (/dossier/i.test(t)) signals.push("dossier header");
    return {
      style: "GIA_LGDR_DOSSIER",
      layout: "lgdr-dossier",
      signals,
    };
  }

  if (
    /natural\s+colored\s+diamond\s+report/i.test(t) ||
    (/natural\s+colored/i.test(t) && /additional\s+information/i.test(t))
  ) {
    signals.push("natural colored report");
    if (/additional\s+information/i.test(t)) {
      signals.push("additional information section");
    }
    return {
      style: "GIA_NATURAL_COLORED_SIMPLIFIED",
      layout: "colored-simplified",
      signals,
    };
  }

  // Client PDF text often drops the colored header but still exposes fancy-color
  // grading fields and a proportions block (angles absent by design).
  if (
    /\bfancy\b/i.test(t) &&
    /color\s+origin/i.test(t) &&
    /proportions:/i.test(t) &&
    !/\bLGDR\b/i.test(t) &&
    !/laboratory[-\s]*grown/i.test(t)
  ) {
    signals.push("fancy color grading fields");
    signals.push("proportions block");
    return {
      style: "GIA_NATURAL_COLORED_SIMPLIFIED",
      layout: "colored-simplified",
      signals,
    };
  }

  if (
    /natural\s+diamond\s+grading\s+report/i.test(t) ||
    /\bfacsimile\b/i.test(t) ||
    (/proportions/i.test(t) && /grading\s+scales/i.test(t))
  ) {
    if (/\bfacsimile\b/i.test(t)) signals.push("facsimile");
    if (/natural\s+diamond\s+grading/i.test(t)) {
      signals.push("natural diamond grading report");
    }
    if (/proportions/i.test(t)) signals.push("proportions section");
    return {
      style: "GIA_NATURAL_FACSIMILE",
      layout: "facsimile",
      signals,
    };
  }

  if (/laboratory[-\s]*grown/i.test(t)) {
    signals.push("laboratory-grown (fallback LGDR bands)");
    return {
      style: "GIA_LGDR_DOSSIER",
      layout: "lgdr-dossier",
      signals,
    };
  }

  signals.push("no strong style match");
  return {
    style: "GIA_UNKNOWN",
    layout: "facsimile",
    signals,
  };
}

/** @deprecated Use detectGiaReportStyle().layout */
export function detectGiaDiagramLayout(combinedText: string): GiaDiagramLayout {
  return detectGiaReportStyle(combinedText).layout;
}

// Re-export legacy names for existing imports
export const GIA_LGDR_DOSSIER_VALUE_BANDS = GIA_LGDR_DOSSIER_DIAGRAM_BANDS;
export const GIA_DIAGRAM_VALUE_BANDS = GIA_NATURAL_FACSIMILE_DIAGRAM_BANDS;
