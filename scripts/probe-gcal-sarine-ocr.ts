import { readFileSync } from "fs";
import { renderPdfPagePngAtScale } from "../lib/calibration-library/ocr";
import { extractTextFromDocument } from "../lib/calibration-library/document-extract";
import { extractFieldsFromReportText } from "../lib/calibration-library/extract-from-text";
import {
  needsGcalSarineProportionImageOcr,
  ocrGcalSarineProportionRegionWithDiagnostics,
} from "../lib/calibration-library/parsers/gcal/gcal-sarine-image-ocr";
import {
  diagnoseGcalSarineProportionExtraction,
  probeSarineFinishFromTextLayer,
} from "../lib/calibration-library/parsers/gcal/gcal-sarine-4cs";

async function main() {
  const path =
    process.argv[2] ??
    "data/light-performance-calibration/uploads/1779553658775-G1360796191.pdf";
  const bytes = readFileSync(path);
  const doc = await extractTextFromDocument(bytes, "application/pdf");
  const parsed = extractFieldsFromReportText(doc.text, {
    lab: "GCAL",
    textMethod: doc.method,
    pdfTextLayerLength: doc.pdfTextLayerLength,
  });

  console.log(
    JSON.stringify(
      {
        pdfTextLayerLength: doc.pdfTextLayerLength,
        parserType: parsed.parserType,
        needsImageOcr: needsGcalSarineProportionImageOcr(parsed.fields),
        fieldsBeforeOcr: {
          tablePercent: parsed.fields.tablePercent,
          depthPercent: parsed.fields.depthPercent,
          crownAngle: parsed.fields.crownAngle,
          pavilionAngle: parsed.fields.pavilionAngle,
        },
        finishFromTextLayer: probeSarineFinishFromTextLayer(doc.text),
      },
      null,
      2,
    ),
  );

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdfDoc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  console.log(JSON.stringify({ numPages: pdfDoc.numPages }, null, 2));

  const renderAttempts: Array<{
    scale: number;
    page: number;
    ok: boolean;
    size?: string;
    mode?: string;
  }> = [];
  let renderError: string | undefined;
  const fontModes = [
    { label: "disableFontFace", disableFontFace: true },
    { label: "useSystemFonts:false", useSystemFonts: false },
    { label: "default", useSystemFonts: true },
  ] as const;
  for (const mode of fontModes) {
    for (const pageNumber of [1, 2]) {
      for (const scale of [2]) {
        try {
          const { createCanvas } = await import("@napi-rs/canvas");
          const doc = await pdfjs.getDocument({
            data: new Uint8Array(bytes),
            ...mode,
          }).promise;
          const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const width = Math.ceil(viewport.width);
      const height = Math.ceil(viewport.height);
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");
      await page.render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;
          renderAttempts.push({
            scale,
            page: pageNumber,
            ok: true,
            size: `${width}x${height}`,
            mode: mode.label,
          });
          renderError = undefined;
          break;
        } catch (err) {
          renderError = err instanceof Error ? err.message : String(err);
          renderAttempts.push({
            scale,
            page: pageNumber,
            ok: false,
            mode: mode.label,
          });
        }
      }
      if (renderAttempts.some((a) => a.ok)) break;
    }
    if (renderAttempts.some((a) => a.ok)) break;
  }
  console.log(JSON.stringify({ renderAttempts, renderError }, null, 2));

  const { text, diagnostics } =
    await ocrGcalSarineProportionRegionWithDiagnostics(bytes);
  const proportionDiag = diagnoseGcalSarineProportionExtraction(text);

  console.log(
    JSON.stringify(
      {
        ocrSteps: diagnostics,
        proportionDiag,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
