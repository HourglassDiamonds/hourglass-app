import { ACCEPTED_REPORT_MIMES } from "./accepted-files";

import { extractPdfTextLayer } from "./extract-pdf-server";

import {
  looksLikeGcal8xReportText,
  looksLikeGcalSarine4csReportText,
} from "./parsers/gcal/gcal-layout-detector";
import type { ExtractionPipelineMode } from "./extraction-mode";
import { isClientExtractionMode } from "./extraction-mode";
import {
  labFamilyLabel,
  logUploadPipelineTiming,
} from "./upload-pipeline-timing";

import { needsGiaProportionOcrSupplement } from "./gia-proportions";
import { ocrGiaFacsimileFullPages } from "./parsers/gia/gia-facsimile-image-ocr";

import { isOcrRuntimeAvailable, ocrImageBuffer, ocrPdfBuffer } from "./ocr";

import {

  MIN_USABLE_PDF_TEXT_CHARS,

  OCR_UNAVAILABLE_COPY,

  PDF_NEEDS_PASTE_COPY,

} from "./pdf-ingest";

import type { TextExtractionMethod } from "./types";



export { ACCEPTED_REPORT_EXTENSIONS } from "./accepted-files";



export function isAcceptedReportMime(mime: string): boolean {

  const m = mime.toLowerCase().split(";")[0]!.trim();

  return ACCEPTED_REPORT_MIMES.has(m);

}



export function isImageMime(mime: string): boolean {

  return mime.toLowerCase().startsWith("image/");

}



export function isPdfMime(mime: string): boolean {

  return mime.toLowerCase().includes("pdf");

}



export type DocumentTextExtraction = {

  text: string;

  method: TextExtractionMethod;

  ocrAttempted: boolean;

  ocrAvailable: boolean;

  notices: string[];

  /** Characters from pdfjs text layer only (0 = image-only PDF). */

  pdfTextLayerLength: number;

  /** No embedded text; GCAL 8X diagram fields rely on image-region OCR. */

  gcalImageOnlyPdf: boolean;

};



function finishDocumentExtraction(

  partial: Omit<DocumentTextExtraction, "pdfTextLayerLength" | "gcalImageOnlyPdf"> & {

    pdfTextLayerLength?: number;

    gcalImageOnlyPdf?: boolean;

  },

): DocumentTextExtraction {

  const pdfTextLayerLength = partial.pdfTextLayerLength ?? 0;

  const text = partial.text;

  const gcalImageOnlyPdf =

    partial.gcalImageOnlyPdf ??

    (pdfTextLayerLength === 0 && looksLikeGcal8xReportText(text));

  const notices = [...partial.notices];

  if (gcalImageOnlyPdf && !notices.some((n) => n.includes("image-region OCR"))) {

    notices.push(

      "GCAL 8X PDF has no embedded text layer; diagram proportions use image-region OCR.",

    );

  }

  return {

    ...partial,

    notices,

    pdfTextLayerLength,

    gcalImageOnlyPdf,

  };

}



export type DocumentExtractOptions = {
  mode?: ExtractionPipelineMode;
};

function likelyGcalPdfForRegionFirst(
  pdfText: string,
  pdfTextLayerLength: number,
): boolean {
  if (pdfTextLayerLength === 0) return true;
  return (
    looksLikeGcal8xReportText(pdfText) ||
    looksLikeGcalSarine4csReportText(pdfText)
  );
}

export async function extractTextFromDocument(
  bytes: Buffer,
  mimeType: string,
  options?: DocumentExtractOptions,
): Promise<DocumentTextExtraction> {

  const notices: string[] = [];

  const ocrAvailable = await isOcrRuntimeAvailable();



  if (isImageMime(mimeType)) {

    if (!ocrAvailable) {

      return finishDocumentExtraction({

        text: "",

        method: "none",

        ocrAttempted: false,

        ocrAvailable: false,

        notices: [OCR_UNAVAILABLE_COPY],

      });

    }

    const ocr = await ocrImageBuffer(bytes);

    if (!ocr.ok || !ocr.text) {

      notices.push(

        ocr.error ?? "OCR could not read this image. Paste report details below.",

      );

      return finishDocumentExtraction({

        text: "",

        method: "none",

        ocrAttempted: true,

        ocrAvailable: true,

        notices,

      });

    }

    return finishDocumentExtraction({

      text: ocr.text,

      method: "ocr",

      ocrAttempted: true,

      ocrAvailable: true,

      notices,

    });

  }



  if (isPdfMime(mimeType)) {
    const pdfOpenStarted = Date.now();
    const pdf = await extractPdfTextLayer(bytes);
    logUploadPipelineTiming({
      phase: "pdf-text-layer",
      durationMs: Date.now() - pdfOpenStarted,
      labFamily: likelyGcalPdfForRegionFirst(pdf.text, pdf.text.length)
        ? "GCAL"
        : undefined,
      detail: `chars=${pdf.text.length} sufficient=${pdf.sufficient}`,
    });

    const pdfTextLayerLength = pdf.text.length;



    if (pdf.sufficient) {

      if (
        !isClientExtractionMode(options?.mode) &&
        needsGiaProportionOcrSupplement(pdf.text) &&
        ocrAvailable
      ) {

        const ocr = await ocrGiaFacsimileFullPages(bytes);

        // Diagram values live in page OCR — put OCR before PDF shell so proportion block selection wins.
        const combined = [ocr.text, pdf.text].filter(Boolean).join("\n\n").trim();

        if (ocr.ok && ocr.text.trim()) {

          return finishDocumentExtraction({

            text: combined,

            method: "ocr",

            ocrAttempted: true,

            ocrAvailable: true,

            notices,

            pdfTextLayerLength,

          });

        }

      }

      return finishDocumentExtraction({

        text: pdf.text,

        method: "pdf-text",

        ocrAttempted: false,

        ocrAvailable,

        notices,

        pdfTextLayerLength,

        gcalImageOnlyPdf: false,

      });

    }



    if (!ocrAvailable) {

      notices.push(OCR_UNAVAILABLE_COPY, PDF_NEEDS_PASTE_COPY);

      return finishDocumentExtraction({

        text: pdf.text,

        method: pdf.text ? "pdf-text" : "none",

        ocrAttempted: false,

        ocrAvailable: false,

        notices,

        pdfTextLayerLength,

      });

    }



    if (isClientExtractionMode(options?.mode)) {
      logUploadPipelineTiming({
        phase: "pdf-full-page-ocr",
        durationMs: 0,
        labFamily: likelyGcalPdfForRegionFirst(pdf.text, pdfTextLayerLength)
          ? "GCAL"
          : undefined,
        detail: "skipped-client-region-first",
      });
      notices.push(
        "Client extract: targeted region OCR only — full-page OCR skipped.",
      );
      return finishDocumentExtraction({
        text: pdf.text,
        method: pdf.text ? "pdf-text" : "none",
        ocrAttempted: false,
        ocrAvailable: true,
        notices,
        pdfTextLayerLength,
        gcalImageOnlyPdf:
          pdfTextLayerLength === 0 ||
          likelyGcalPdfForRegionFirst(pdf.text, pdfTextLayerLength),
      });
    }

    const giaOcrFirst = needsGiaProportionOcrSupplement(pdf.text);
    const fullOcrStarted = Date.now();
    const ocr = giaOcrFirst
      ? await ocrGiaFacsimileFullPages(bytes)
      : await ocrPdfBuffer(bytes);
    logUploadPipelineTiming({
      phase: "pdf-full-page-ocr",
      durationMs: Date.now() - fullOcrStarted,
      labFamily: giaOcrFirst
        ? labFamilyLabel("GIA")
        : likelyGcalPdfForRegionFirst(pdf.text, pdfTextLayerLength)
          ? "GCAL"
          : undefined,
      detail: giaOcrFirst ? "gia-facsimile-pages" : "pdf-buffer-pages",
    });

    const combined = (
      giaOcrFirst ? [ocr.text, pdf.text] : [pdf.text, ocr.text]
    )
      .filter(Boolean)
      .join("\n\n")
      .trim();

    if (ocr.ok && ocr.text.length >= MIN_USABLE_PDF_TEXT_CHARS) {

      return finishDocumentExtraction({

        text: combined || ocr.text,

        method: "ocr",

        ocrAttempted: true,

        ocrAvailable: true,

        notices,

        pdfTextLayerLength,

      });

    }



    notices.push(

      ocr.error ??

        "PDF text layer was empty and OCR found little text. Paste report details below.",

    );

    if (combined.length > 0) {

      return finishDocumentExtraction({

        text: combined,

        method: "ocr",

        ocrAttempted: true,

        ocrAvailable: true,

        notices,

        pdfTextLayerLength,

      });

    }



    return finishDocumentExtraction({

      text: "",

      method: "none",

      ocrAttempted: true,

      ocrAvailable: true,

      notices,

      pdfTextLayerLength,

    });

  }



  notices.push("Unsupported file type.");

  return finishDocumentExtraction({

    text: "",

    method: "none",

    ocrAttempted: false,

    ocrAvailable,

    notices,

  });

}


