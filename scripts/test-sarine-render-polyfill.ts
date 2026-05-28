import { readFileSync } from "fs";

const bytes = readFileSync(
  process.argv[2] ??
    "data/light-performance-calibration/uploads/1779553658775-G1360796191.pdf",
);

async function main() {
  const napi = await import("@napi-rs/canvas");
  const g = globalThis as Record<string, unknown>;
  if (!g.Image) g.Image = napi.Image;
  if (!g.DOMMatrix) g.DOMMatrix = napi.DOMMatrix;
  if (!g.ImageData) g.ImageData = napi.ImageData;
  if (!g.Path2D) g.Path2D = napi.Path2D;

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    disableFontFace: true,
  }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const w = Math.ceil(viewport.width);
  const h = Math.ceil(viewport.height);
  const canvas = napi.createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  await page.render({
    canvasContext: ctx as unknown as CanvasRenderingContext2D,
    viewport,
  }).promise;
  console.log("OK", w, h, canvas.toBuffer("image/png").length);
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
