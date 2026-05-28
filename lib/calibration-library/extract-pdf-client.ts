/**
 * Client-side PDF text extraction (user upload only — no lab website access).
 */
import {
  MIN_USABLE_PDF_TEXT_CHARS,
  type PdfTextExtractResult,
} from "./pdf-ingest";

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

export async function extractTextFromPdfFile(
  file: File,
): Promise<PdfTextExtractResult> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const version =
      typeof pdfjs.version === "string" ? pdfjs.version : "4.10.38";
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/legacy/build/pdf.worker.min.mjs`;
    }

    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

    const parts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      parts.push(pageTextFromContent(content.items as TextItem[]));
    }

    const text = parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
    const sufficient = text.length >= MIN_USABLE_PDF_TEXT_CHARS;

    return { text, sufficient };
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF read failed";
    return { text: "", sufficient: false, error: message };
  }
}
