import { extractPdfTextLayer } from "@/lib/calibration-library/extract-pdf-server";
import { isImageMime, isPdfMime } from "@/lib/calibration-library/document-extract";
import {
  looksLikeGcal8xCertificateProbeText,
  looksLikeGcal8xReportText,
} from "@/lib/calibration-library/parsers/gcal/gcal-layout-detector";
import { probeGcal8xImageOnlyPdf } from "@/lib/calibration-library/parsers/gcal/gcal-image-ocr";
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

async function ocrFormatProbeHeaderFromImage(
  imageBytes: Buffer,
): Promise<string> {
  if (!(await isOcrRuntimeAvailable())) return "";

  const rendered = await renderUploadImageAsPage(imageBytes);
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

/** GCAL 8X image-only HEADER_TINY — must fall through to existing 8X pipeline. */
function shouldDeferToGcal8xPipeline(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (looksLikeGcal8xReportText(t)) return true;
  if (looksLikeGcal8xCertificateProbeText(t)) return true;
  return false;
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
    if (layerUnsupported) return layerUnsupported;

    const layerSupport = assessClientReportFormatSupport(layer.text);
    if (layerSupport.status === "supported") return null;

    if (layer.sufficient && layerSupport.status === "unknown") {
      return null;
    }

    const gcal8xProbe = await probeGcal8xImageOnlyPdf(bytes);
    if (gcal8xProbe.detected || shouldDeferToGcal8xPipeline(gcal8xProbe.probeText)) {
      return null;
    }

    const headerText = await ocrFormatProbeHeaderFromPdf(bytes);
    if (shouldDeferToGcal8xPipeline(headerText)) return null;

    return unsupportedMatchFromText(
      [layer.text, gcal8xProbe.probeText, headerText].filter(Boolean).join("\n\n"),
    );
  }

  if (isImageMime(mime)) {
    const headerText = await ocrFormatProbeHeaderFromImage(bytes);
    if (shouldDeferToGcal8xPipeline(headerText)) return null;
    return unsupportedMatchFromText(headerText);
  }

  return null;
}

/** Exported for tests — minimum text layer length treated as sufficient. */
export const FORMAT_PROBE_MIN_TEXT_LAYER_CHARS = MIN_USABLE_PDF_TEXT_CHARS;
