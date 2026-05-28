import { readFileSync } from "fs";
import { join } from "path";

const pdfPath =
  process.argv[2] ??
  "data/light-performance-calibration/uploads/1779553658775-G1360796191.pdf";
const bytes = readFileSync(pdfPath);

function nodeCanvasFactory(createCanvas: (w: number, h: number) => {
  getContext: (t: string) => CanvasRenderingContext2D;
  toBuffer: (mime: string) => Buffer;
  width: number;
  height: number;
}) {
  return {
    create(width: number, height: number) {
      const canvas = createCanvas(width, height);
      return { canvas, context: canvas.getContext("2d") };
    },
    reset(
      cc: { canvas: { width: number; height: number } },
      width: number,
      height: number,
    ) {
      cc.canvas.width = width;
      cc.canvas.height = height;
    },
    destroy(cc: { canvas: { width: number; height: number } }) {
      cc.canvas.width = 0;
      cc.canvas.height = 0;
    },
  };
}

async function tryRender(
  label: string,
  opts: Record<string, unknown>,
  canvasPkg: "@napi-rs/canvas" | "canvas",
) {
  try {
    const { createCanvas } = await import(canvasPkg);
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(bytes),
      ...opts,
    }).promise;
    const pageNum = Number(process.env.PAGE ?? 1);
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 });
    const w = Math.ceil(viewport.width);
    const h = Math.ceil(viewport.height);
    const factory = nodeCanvasFactory(createCanvas);
    const cc = factory.create(w, h);
    await page.render({
      canvasContext: cc.context as unknown as CanvasRenderingContext2D,
      viewport,
      canvasFactory: factory,
    }).promise;
    const canvas = cc.canvas as { toBuffer: (mime: string) => Buffer };
    console.log(label, "OK", `${w}x${h}`, "bytes", canvas.toBuffer("image/png").length);
    return true;
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.log(label, "FAIL", err.message);
    if (process.env.VERBOSE === "1") console.log(err.stack);
    return false;
  }
}

async function main() {
  const standardFontDataUrl = join(
    process.cwd(),
    "node_modules/pdfjs-dist/standard_fonts/",
  );
  const modes = [
    { label: "default", opts: { useSystemFonts: true } },
    { label: "no-system-fonts", opts: { useSystemFonts: false } },
    { label: "disableFontFace", opts: { disableFontFace: true } },
    {
      label: "disableFontFace+noSystem",
      opts: { disableFontFace: true, useSystemFonts: false },
    },
    {
      label: "standardFontDataUrl",
      opts: { standardFontDataUrl, useSystemFonts: false },
    },
  ];
  for (const pkg of ["@napi-rs/canvas", "canvas"] as const) {
    console.log("--- canvas pkg:", pkg, "---");
    for (const m of modes) {
      await tryRender(`${pkg}:${m.label}`, m.opts, pkg);
    }
  }
}

main();
