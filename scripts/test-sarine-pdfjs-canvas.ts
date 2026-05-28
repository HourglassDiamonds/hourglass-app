import { createRequire } from "module";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

const bytes = readFileSync(
  "data/light-performance-calibration/uploads/1779553658775-G1360796191.pdf",
);

async function main() {
  const requireFromPdfjs = createRequire(
    fileURLToPath(
      new URL("../node_modules/pdfjs-dist/legacy/build/pdf.mjs", import.meta.url),
    ),
  );
  const canvasPkg = requireFromPdfjs("@napi-rs/canvas");
  console.log("canvas version path", requireFromPdfjs.resolve("@napi-rs/canvas"));

  const g = globalThis as Record<string, unknown>;
  if (!g.Path2D && canvasPkg.Path2D) g.Path2D = canvasPkg.Path2D;
  if (!g.DOMMatrix && canvasPkg.DOMMatrix) g.DOMMatrix = canvasPkg.DOMMatrix;
  if (!g.ImageData && canvasPkg.ImageData) g.ImageData = canvasPkg.ImageData;
  if (!g.Image && canvasPkg.Image) g.Image = canvasPkg.Image;

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    useSystemFonts: false,
  }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const w = Math.ceil(viewport.width);
  const h = Math.ceil(viewport.height);

  const factory = {
    create(width: number, height: number) {
      const c = canvasPkg.createCanvas(width, height);
      return { canvas: c, context: c.getContext("2d") };
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
  }).promise;
  console.log("OK", cc.canvas.toBuffer("image/png").length);
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
