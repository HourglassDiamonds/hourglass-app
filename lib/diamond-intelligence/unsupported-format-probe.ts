import { extractPdfTextLayer } from "@/lib/calibration-library/extract-pdf-server";
import { isImageMime, isPdfMime } from "@/lib/calibration-library/document-extract";
import {
  looksLikeGcal8xCertificateProbeText,
  looksLikeGcal8xReportText,
  hasStrongGcal8xDeferEvidence,
} from "@/lib/calibration-library/parsers/gcal/gcal-layout-detector";
import {
  probeGcal8xCertificateRegionFromRenderedPage,
  probeGcal8xImageOnlyPdf,
  type Gcal8xImageOnlyPdfProbeResult,
} from "@/lib/calibration-library/parsers/gcal/gcal-image-ocr";
import {
  isOcrRuntimeAvailable,
  ocrImageBuffer,
  renderPdfPagePngAtScale,
  renderUploadImageAsPage,
} from "@/lib/calibration-library/ocr";
import { MIN_USABLE_PDF_TEXT_CHARS } from "@/lib/calibration-library/pdf-ingest";
import { withTimeout } from "@/lib/calibration-library/runtime-guard";
import {
  OCR_SINGLE_IMAGE_TIMEOUT_MS,
  PDF_TEXT_LAYER_TIMEOUT_MS,
} from "@/lib/calibration-library/runtime-limits";
import {
  assessClientReportFormatSupport,
  type UnsupportedReportFormatMatch,
} from "@/lib/diamond-intelligence/unsupported-report-format";

/** Wide top band — DGA / lab headers without full-page OCR. */
const FORMAT_PROBE_HEADER_CROP = {
  left: 0,
  top: 0,
  width: 1,
  height: 0.32,
} as const;

type PercentCrop = {
  left: number;
  top: number;
  width: number;
  height: number;
};

async function cropPageRegionPng(
  pagePng: Buffer,
  pageWidth: number,
  pageHeight: number,
  crop: PercentCrop,
): Promise<Buffer | null> {
  try {
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const img = await loadImage(pagePng);
    const sx = Math.max(0, Math.floor(crop.left * pageWidth));
    const sy = Math.max(0, Math.floor(crop.top * pageHeight));
    const w = Math.max(
      1,
      Math.min(pageWidth - sx, Math.floor(crop.width * pageWidth)),
    );
    const h = Math.max(
      1,
      Math.min(pageHeight - sy, Math.floor(crop.height * pageHeight)),
    );
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
    return canvas.toBuffer("image/png");
  } catch {
    return null;
  }
}

async function ocrFormatProbeHeaderFromPdf(
  pdfBytes: Buffer,
): Promise<string> {
  if (!(await isOcrRuntimeAvailable())) return "";

  const rendered = await renderPdfPagePngAtScale(pdfBytes, 1, 3);
  if (!rendered) return "";

  const headerPng = await cropPageRegionPng(
    rendered.png,
    rendered.width,
    rendered.height,
    FORMAT_PROBE_HEADER_CROP,
  );
  if (!headerPng) return "";

  const ocr = await withTimeout(
    ocrImageBuffer(headerPng),
    OCR_SINGLE_IMAGE_TIMEOUT_MS,
    "unsupported-format-header-ocr",
  );
  return ocr.ok ? ocr.text.trim() : "";
}

async function ocrFormatProbeHeaderFromRenderedPage(rendered: {
  png: Buffer;
  width: number;
  height: number;
}): Promise<string> {
  const headerPng = await cropPageRegionPng(
    rendered.png,
    rendered.width,
    rendered.height,
    FORMAT_PROBE_HEADER_CROP,
  );
  if (!headerPng) return "";

  const ocr = await withTimeout(
    ocrImageBuffer(headerPng),
    OCR_SINGLE_IMAGE_TIMEOUT_MS,
    "unsupported-format-image-header-ocr",
  );
  return ocr.ok ? ocr.text.trim() : "";
}

function unsupportedMatchFromText(
  text: string,
): UnsupportedReportFormatMatch | null {
  const support = assessClientReportFormatSupport(text);
  return support.status === "unsupported" ? support.match : null;
}

/** Probe-only OCR repair — common GCAL token misreads in screenshot uploads. */
export function normalizeGcalProbeOcrText(text: string): string {
  return text
    .replace(/\bGOAL\b/gi, "GCAL")
    .replace(/\bG0AL\b/gi, "GCAL")
    .replace(/\bGEA\b/gi, "GCAL")
    .replace(/\bGCAlY\b/gi, "GCAL")
    .replace(/\bGea\b/g, "GCAL")
    .replace(/\bby\s+sane\b/gi, "by Sarine")
    .replace(/\bby\s+sarne\b/gi, "by Sarine");
}

function hasGcal8xSparseProbeExclusion(text: string): boolean {
  if (/\b8\s*x\b/i.test(text)) return true;
  if (/ultimate\s+diamond/i.test(text)) return true;
  if (/\beight\b[\s\S]{0,48}\bcut\s+grade\b/i.test(text)) return true;
  return false;
}

/**
 * Strong Gcal8x defer evidence with probe OCR normalization applied.
 */
export function hasStrongGcal8xProbeDeferEvidence(text: string): boolean {
  return hasStrongGcal8xDeferEvidence(normalizeGcalProbeOcrText(text));
}

function shouldDeferFromGcal8xProbeText(text: string): boolean {
  return hasStrongGcal8xProbeDeferEvidence(text);
}

function gcal8xEvidenceWinsOverSarineUnsupported(
  ...texts: Array<string | undefined>
): boolean {
  return texts.some((text) => hasStrongGcal8xProbeDeferEvidence(text ?? ""));
}

/**
 * Sparse Sarine-layout screenshot — proportion diagram panel without clean GCAL OCR.
 * Probe-layer only; does not broaden parser Sarine support.
 */
export function looksLikeSparseGcalSarineScreenshotText(text: string): boolean {
  const t = normalizeGcalProbeOcrText(text).trim();
  if (!t) return false;
  if (looksLikeGcal8xReportText(t)) return false;
  if (hasGcal8xSparseProbeExclusion(t)) return false;

  const hasProportionDiagram = /proportion\s+diagram/i.test(t);
  const hasLabGrown = /lab\s+grown\s+diamond/i.test(t);
  const hasPanelMarker =
    /(?:4c'?s|laser\s+inscription)/i.test(t) ||
    /\bby\s+sar?in[eé]?\b/i.test(t);

  return hasProportionDiagram && hasLabGrown && hasPanelMarker;
}

function sparseGcalSarineScreenshotUnsupported(
  text: string,
): UnsupportedReportFormatMatch | null {
  if (!looksLikeSparseGcalSarineScreenshotText(text)) return null;
  return { family: "gcal-sarine-4cs", label: "GCAL BY SARINE" };
}

/** GCAL 8X image-only HEADER_TINY — must fall through to existing 8X pipeline. */
function shouldDeferToGcal8xPipeline(text: string): boolean {
  return shouldDeferFromGcal8xProbeText(text);
}

/** Header OCR with strong standard/Sarine markers — PDF text-layer equivalent for images. */
function earlyImageHeaderUnsupported(
  headerText: string,
): UnsupportedReportFormatMatch | null {
  const support = assessClientReportFormatSupport(headerText);
  if (support.status !== "unsupported") return null;
  if (support.match.family === "gcal-sarine-4cs") return support.match;
  if (
    support.match.family === "gcal-standard" &&
    /\bphysical\s+symmetry\b/i.test(headerText) &&
    /\boptical\s+brilliance\b/i.test(headerText)
  ) {
    return support.match;
  }
  return null;
}

export type ImageFormatProbeOcrInput = {
  headerText: string;
  certProbe: Gcal8xImageOnlyPdfProbeResult;
};

/**
 * Image upload unsupported-format decision — mirrors PDF probe ordering using
 * header OCR as the text-layer equivalent and cert-band OCR as the 8X probe.
 */
export function resolveImageUnsupportedFormatProbe(
  input: ImageFormatProbeOcrInput,
): UnsupportedReportFormatMatch | null {
  const headerNorm = normalizeGcalProbeOcrText(input.headerText);
  const certNorm = normalizeGcalProbeOcrText(input.certProbe.probeText);

  if (
    input.certProbe.detected ||
    shouldDeferToGcal8xPipeline(certNorm) ||
    shouldDeferToGcal8xPipeline(headerNorm)
  ) {
    return null;
  }

  const earlyHeader = earlyImageHeaderUnsupported(headerNorm);
  if (
    earlyHeader &&
    !gcal8xEvidenceWinsOverSarineUnsupported(certNorm, headerNorm)
  ) {
    return earlyHeader;
  }

  const combined = [headerNorm, certNorm].filter(Boolean).join("\n\n");
  if (gcal8xEvidenceWinsOverSarineUnsupported(combined, certNorm)) {
    return null;
  }

  const combinedUnsupported = unsupportedMatchFromText(combined);
  if (combinedUnsupported) return combinedUnsupported;

  const headerFallback = unsupportedMatchFromText(headerNorm);
  if (headerFallback) return headerFallback;

  const sparseUnsupported = sparseGcalSarineScreenshotUnsupported(combined);
  if (sparseUnsupported) return sparseUnsupported;

  return null;
}

export type PdfFormatProbeTextInput = {
  layerText: string;
  layerSufficient: boolean;
  certProbe: Gcal8xImageOnlyPdfProbeResult;
  headerText?: string;
};

/** PDF unsupported-format decision from OCR/text-layer inputs — mirrors probeClientUnsupportedReportFormat. */
export function resolvePdfUnsupportedFormatProbeFromText(
  input: PdfFormatProbeTextInput,
): UnsupportedReportFormatMatch | null {
  const certProbeText = normalizeGcalProbeOcrText(input.certProbe.probeText);

  const layerUnsupported = unsupportedMatchFromText(input.layerText);
  if (input.layerSufficient && layerUnsupported) {
    return layerUnsupported;
  }

  if (
    input.certProbe.detected ||
    shouldDeferToGcal8xPipeline(certProbeText)
  ) {
    return null;
  }

  if (layerUnsupported) {
    if (
      layerUnsupported.family === "gcal-sarine-4cs" &&
      gcal8xEvidenceWinsOverSarineUnsupported(certProbeText, input.layerText)
    ) {
      return null;
    }
    return layerUnsupported;
  }

  const layerSupport = assessClientReportFormatSupport(input.layerText);
  if (layerSupport.status === "supported") return null;

  if (input.layerSufficient && layerSupport.status === "unknown") {
    return null;
  }

  const headerNorm = normalizeGcalProbeOcrText(input.headerText ?? "");
  if (shouldDeferToGcal8xPipeline(headerNorm)) return null;

  const combined = [input.layerText, certProbeText, headerNorm]
    .filter(Boolean)
    .join("\n\n");
  if (gcal8xEvidenceWinsOverSarineUnsupported(combined, certProbeText)) {
    return null;
  }

  return unsupportedMatchFromText(combined);
}

async function probeImageUnsupportedFormat(
  imageBytes: Buffer,
): Promise<UnsupportedReportFormatMatch | null> {
  if (!(await isOcrRuntimeAvailable())) {
    return unsupportedMatchFromText("");
  }

  const rendered = await renderUploadImageAsPage(imageBytes);
  if (!rendered) {
    return unsupportedMatchFromText("");
  }

  const headerText = await ocrFormatProbeHeaderFromRenderedPage(rendered);
  const certProbe =
    await probeGcal8xCertificateRegionFromRenderedPage(rendered);

  return resolveImageUnsupportedFormatProbe({ headerText, certProbe });
}

/**
 * Fast client-only unsupported-format probe.
 * Never runs full-page OCR or parser routing.
 * Returns a match when the upload should stop with unsupported_report_format.
 */
export async function probeClientUnsupportedReportFormat(
  bytes: Buffer,
  mime: string,
): Promise<UnsupportedReportFormatMatch | null> {
  if (isPdfMime(mime)) {
    const layer = await withTimeout(
      extractPdfTextLayer(bytes),
      PDF_TEXT_LAYER_TIMEOUT_MS,
      "unsupported-format-text-layer",
    );

    const layerUnsupported = unsupportedMatchFromText(layer.text);
    if (layer.sufficient && layerUnsupported) {
      return layerUnsupported;
    }

    const gcal8xProbe = await probeGcal8xImageOnlyPdf(bytes);
    const certProbeText = normalizeGcalProbeOcrText(gcal8xProbe.probeText);

    if (
      gcal8xProbe.detected ||
      shouldDeferToGcal8xPipeline(certProbeText)
    ) {
      return null;
    }

    const withoutHeader = resolvePdfUnsupportedFormatProbeFromText({
      layerText: layer.text,
      layerSufficient: layer.sufficient,
      certProbe: gcal8xProbe,
    });
    if (withoutHeader !== null) return withoutHeader;

    const layerSupport = assessClientReportFormatSupport(layer.text);
    if (layerSupport.status === "supported") return null;
    if (layer.sufficient && layerSupport.status === "unknown") return null;

    const headerText = await ocrFormatProbeHeaderFromPdf(bytes);
    return resolvePdfUnsupportedFormatProbeFromText({
      layerText: layer.text,
      layerSufficient: layer.sufficient,
      certProbe: gcal8xProbe,
      headerText,
    });
  }

  if (isImageMime(mime)) {
    return probeImageUnsupportedFormat(bytes);
  }

  return null;
}

/** Exported for tests — minimum text layer length treated as sufficient. */
export const FORMAT_PROBE_MIN_TEXT_LAYER_CHARS = MIN_USABLE_PDF_TEXT_CHARS;
