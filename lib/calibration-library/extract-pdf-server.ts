/**
 * Server-side PDF text layer extraction (no OCR). Bounded page count + timeouts.
 */
import {
  CalibrationTimeoutError,
  logCalibrationRuntimeCheck,
  withTimeout,
} from "./runtime-guard";
import { MIN_USABLE_PDF_TEXT_CHARS } from "./pdf-ingest";
import {
  MAX_PDF_PAGES_TEXT_LAYER,
  PDF_GET_DOCUMENT_TIMEOUT_MS,
  PDF_TEXT_LAYER_TIMEOUT_MS,
} from "./runtime-limits";

type TextItem = { str?: string; transform?: number[]; hasEOL?: boolean };

function pageTextFromContent(items: TextItem[]): string {
  const lines: string[] = [];
  let line = "";
  let lastY: number | null = null;

  for (const item of items) {
    const str = typeof item.str === "string" ? item.str : "";
    if (!str) continue;

    const y = item.transform?.[5];
    if (
      y !== undefined &&
      lastY !== null &&
      Math.abs(y - lastY) > 4 &&
      line.trim()
    ) {
      lines.push(line.trim());
      line = str;
    } else {
      line += line ? (item.hasEOL ? "\n" : " ") + str : str;
    }
    if (item.hasEOL && line.trim()) {
      lines.push(line.trim());
      line = "";
    }
    if (y !== undefined) lastY = y;
  }
  if (line.trim()) lines.push(line.trim());

  return lines.join("\n");
}

export async function extractPdfTextLayer(bytes: Buffer): Promise<{
  text: string;
  sufficient: boolean;
}> {
  const started = Date.now();
  let pageCount = 0;

  try {
    const result = await withTimeout(
      (async () => {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const data = new Uint8Array(bytes);
        const doc = await withTimeout(
          pdfjs.getDocument({ data, useSystemFonts: true }).promise,
          PDF_GET_DOCUMENT_TIMEOUT_MS,
          "pdf-text-open",
        );
        pageCount = doc.numPages;
        const pagesToRead = Math.min(doc.numPages, MAX_PDF_PAGES_TEXT_LAYER);

        const parts: string[] = [];
        for (let i = 1; i <= pagesToRead; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          parts.push(pageTextFromContent(content.items as TextItem[]));
        }

        const text = parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
        return {
          text,
          sufficient: text.length >= MIN_USABLE_PDF_TEXT_CHARS,
        };
      })(),
      PDF_TEXT_LAYER_TIMEOUT_MS,
      "pdf-text-layer",
    );
    return result;
  } catch (err) {
    logCalibrationRuntimeCheck({
      operation: "pdf-text-layer",
      pageCount,
      durationMs: Date.now() - started,
      timedOut: err instanceof CalibrationTimeoutError,
      error: err instanceof Error ? err.message : String(err),
    });
    return { text: "", sufficient: false };
  } finally {
    logCalibrationRuntimeCheck({
      operation: "pdf-text-layer",
      pageCount,
      durationMs: Date.now() - started,
    });
  }
}
