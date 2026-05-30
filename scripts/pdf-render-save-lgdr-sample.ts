/** One-off: save factory-render PNG + OCR preview for GIA-2496027047 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { createRequire } from "module";
import { capRenderScaleForPixels } from "@/lib/calibration-library/runtime-limits";
import { ocrImageBuffer } from "@/lib/calibration-library/ocr";

async function main() {
  const pdfBytes = readFileSync(
    "data/light-performance-calibration/validation-reports/GIA-2496027047.pdf",
  );
  const nodeRequire = createRequire(import.meta.url);
  const requireFromPdfjs = createRequire(
    nodeRequire.resolve("pdfjs-dist/legacy/build/pdf.mjs"),
  );
  const canvasPkg = requireFromPdfjs("@napi-rs/canvas") as {
    createCanvas: (w: number, h: number) => {
      getContext: (t: "2d") => CanvasRenderingContext2D;
      toBuffer: (m: string) => Buffer;
      width: number;
      height: number;
    };
    Path2D?: unknown;
    DOMMatrix?: unknown;
    ImageData?: unknown;
    Image?: unknown;
  };
  const g = globalThis as Record<string, unknown>;
  if (!g.Path2D && canvasPkg.Path2D) g.Path2D = canvasPkg.Path2D;
  if (!g.DOMMatrix && canvasPkg.DOMMatrix) g.DOMMatrix = canvasPkg.DOMMatrix;
  if (!g.ImageData && canvasPkg.ImageData) g.ImageData = canvasPkg.ImageData;
  if (!g.Image && canvasPkg.Image) g.Image = canvasPkg.Image;

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdfBytes),
    disableFontFace: true,
    useSystemFonts: false,
  }).promise;
  const page = await doc.getPage(1);
  const scale = 5;
  const base = page.getViewport({ scale: 1 });
  const effectiveScale = capRenderScaleForPixels(base.width, base.height, scale);
  const viewport = page.getViewport({ scale: effectiveScale });
  const w = Math.ceil(viewport.width);
  const h = Math.ceil(viewport.height);
  const factory = {
    create(width: number, height: number) {
      const canvas = canvasPkg.createCanvas(width, height);
      return { canvas, context: canvas.getContext("2d") };
    },
    reset(cc: { canvas: { width: number; height: number } }, width: number, height: number) {
      cc.canvas.width = width;
      cc.canvas.height = height;
    },
    destroy(cc: { canvas: { width: number; height: number } }) {
      cc.canvas.width = 0;
      cc.canvas.height = 0;
    },
  };
  const cc = factory.create(w, h);
  await page.render({
    canvasContext: cc.context as unknown as CanvasRenderingContext2D,
    viewport,
    canvasFactory: factory,
  } as Parameters<typeof page.render>[0]).promise;
  const png = cc.canvas.toBuffer("image/png");
  const dir = "data/light-performance-calibration/debug/render";
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "GIA-2496027047-factory-s5-p1.png"), png);
  const ocr = await ocrImageBuffer(png);
  writeFileSync(join(dir, "GIA-2496027047-factory-s5-p1-ocr.txt"), ocr.text, "utf8");
  console.log("saved", w, "x", h, "ocr chars", ocr.text.length);
  console.log(ocr.text.slice(0, 1200));
}

main().catch(console.error);
