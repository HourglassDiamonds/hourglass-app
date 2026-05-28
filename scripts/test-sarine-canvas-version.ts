import { createRequire } from "module";
import { readFileSync } from "fs";

const require = createRequire(import.meta.url);
const bytes = readFileSync(
  "data/light-performance-calibration/uploads/1779553658775-G1360796191.pdf",
);

async function tryPkg(label: string, createCanvas: (w: number, h: number) => {
  getContext: (t: string) => CanvasRenderingContext2D;
  toBuffer: (m: string) => Buffer;
}) {
  try {
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
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");
    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    console.log(label, "OK", canvas.toBuffer("image/png").length);
  } catch (e) {
    console.log(label, "FAIL", e instanceof Error ? e.message : e);
  }
}

async function main() {
  const root = await import("@napi-rs/canvas");
  await tryPkg("root-1.0.0", root.createCanvas);

  const pdfjsCanvasPath = require.resolve("@napi-rs/canvas", {
    paths: [require.resolve("pdfjs-dist/package.json")],
  });
  const nested = await import(pdfjsCanvasPath);
  await tryPkg("pdfjs-nested-0.1.100", nested.createCanvas);
}

main();
