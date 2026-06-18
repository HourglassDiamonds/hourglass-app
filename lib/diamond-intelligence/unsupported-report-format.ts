import {
  hasExplicitGcalSarineReportHeader,
  hasExplicitIgiReportHeader,
  looksLikeIgiReportText,
} from "@/lib/calibration-library/lab-parsers";
import {
  looksLikeGcal8xCertificateProbeText,
  looksLikeGcal8xReportText,
  looksLikeGcalSarine4csReportText,
  hasStrongGcal8xDeferEvidence,
} from "@/lib/calibration-library/parsers/gcal/gcal-layout-detector";
import { looksLikeGiaReportText } from "@/lib/calibration-library/gia-proportions";

/** Client beta — GCAL 8X (reuses existing layout detector; does not modify it). */
export function isSupportedGcal8xReportText(text: string): boolean {
  return looksLikeGcal8xReportText(text);
}

/** Standard GCAL Diamond Grading Analysis — not 8X, not Sarine. */
export function looksLikeGcalStandardReportText(text: string): boolean {
  const t = text.slice(0, 20000);
  if (isSupportedGcal8xReportText(t)) return false;
  if (
    hasExplicitGcalSarineReportHeader(t) ||
    looksLikeGcalSarine4csReportText(t)
  ) {
    return false;
  }

  const gcalAgency = /gem\s+certification\s*&\s*assurance/i.test(t);
  const dga = /diamond\s+grading\s+analysis/i.test(t);
  const physicalOptical =
    /\bphysical\s+symmetry\b/i.test(t) &&
    /\boptical\s+brilliance\b/i.test(t);

  if (gcalAgency && dga) return true;
  if (gcalAgency && physicalOptical) return true;
  if (dga && physicalOptical && /\bcertificate\s+no\.?\s+LG\d/i.test(t)) {
    return true;
  }
  return false;
}

type UnsupportedLabSignature = {
  family: string;
  label: string;
  test: (text: string) => boolean;
};

const RECOGNIZED_UNSUPPORTED_LAB_SIGNATURES: UnsupportedLabSignature[] = [
  {
    family: "hrd",
    label: "HRD",
    test: (t) =>
      /\bHRD\b/i.test(t) ||
      /hrd\s+antwerp/i.test(t) ||
      /diamond\s+high\s+council/i.test(t),
  },
  {
    family: "egl",
    label: "EGL",
    test: (t) =>
      /\bEGL\b/i.test(t) ||
      /european\s+gemological\s+laboratory/i.test(t),
  },
  {
    family: "gsi",
    label: "GSI",
    test: (t) =>
      /\bGSI\b/i.test(t) ||
      /gemological\s+science\s+international/i.test(t),
  },
  {
    family: "ags-legacy",
    label: "AGS",
    test: (t) =>
      /\bAGS\b/i.test(t) ||
      /american\s+gem\s+society/i.test(t) ||
      /ags\s+laboratories/i.test(t) ||
      /platinum\s+light\s+performance/i.test(t),
  },
  {
    family: "dbiod",
    label: "DBIOD",
    test: (t) => /\bDBIOD\b/i.test(t) || /\bde\s+beers\b/i.test(t),
  },
  {
    family: "iidgr",
    label: "IIDGR",
    test: (t) =>
      /\bIIDGR\b/i.test(t) ||
      /international\s+institute\s+of\s+diamond\s+grading/i.test(t),
  },
];

export type UnsupportedReportFormatMatch = {
  family: string;
  label: string;
};

export type ClientReportFormatSupport =
  | { status: "supported" }
  | { status: "unsupported"; match: UnsupportedReportFormatMatch }
  | { status: "unknown" };

function detectRecognizedUnsupportedFamily(
  text: string,
): UnsupportedReportFormatMatch | null {
  const t = text.trim();
  if (!t) return null;

  for (const sig of RECOGNIZED_UNSUPPORTED_LAB_SIGNATURES) {
    if (sig.test(t)) {
      return { family: sig.family, label: sig.label };
    }
  }

  if (
    hasExplicitGcalSarineReportHeader(t) ||
    looksLikeGcalSarine4csReportText(t)
  ) {
    if (looksLikeGcal8xReportText(t) || hasStrongGcal8xDeferEvidence(t)) {
      return null;
    }
    return { family: "gcal-sarine-4cs", label: "GCAL BY SARINE" };
  }

  if (looksLikeGcalStandardReportText(t)) {
    return { family: "gcal-standard", label: "Standard GCAL" };
  }

  if (/\bGCAL\b/i.test(t) && !looksLikeGcal8xReportText(t)) {
    // Image-only GCAL 8X certificate probe — defer to existing 8X OCR pipeline.
    if (looksLikeGcal8xCertificateProbeText(t)) {
      return null;
    }
    return { family: "gcal-non-8x", label: "GCAL (non-8X)" };
  }

  return null;
}

function isPositivelySupportedClientReport(text: string): boolean {
  const t = text.trim();
  if (!t) return false;

  if (isSupportedGcal8xReportText(t)) return true;
  if (hasExplicitIgiReportHeader(t)) return true;
  if (looksLikeIgiReportText(t) && !/\bGCAL\b/i.test(t)) return true;
  if (looksLikeGiaReportText(t) && !looksLikeGcalStandardReportText(t)) {
    return true;
  }

  return false;
}

/**
 * Client-only report-format gate — runs before parser execution.
 * Positively identified unsupported families never enter GIA/IGI/GCAL parsers.
 */
export function assessClientReportFormatSupport(
  text: string,
): ClientReportFormatSupport {
  const trimmed = text.trim();
  if (!trimmed) return { status: "unknown" };

  const unsupported = detectRecognizedUnsupportedFamily(trimmed);
  if (unsupported) {
    return { status: "unsupported", match: unsupported };
  }

  if (isPositivelySupportedClientReport(trimmed)) {
    return { status: "supported" };
  }

  return { status: "unknown" };
}
