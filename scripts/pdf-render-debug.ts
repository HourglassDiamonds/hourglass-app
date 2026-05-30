import { readFileSync } from "fs";

type CanvasAndContext = {
  canvas: { width: number; height: number; toBuffer: (t: "image/png") => Buffer };
  context: CanvasRenderingContext2D;
};

class NodeCanvasFactory {
  create(width: number, height: number): CanvasAndContext {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createCanvas } = require("canvas") as typeof import("canvas");
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context: context as unknown as CanvasRenderingContext2D };
  }

  reset(canvasAndContext: CanvasAndContext, width: number, height: number): void {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: CanvasAndContext): void {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

async function tryNodeCanvasFactory(path: string) {
  const pdfBytes = readFileSync(path);
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const factory = new NodeCanvasFactory();
  const doc = await pdfjs
    .getDocument({
      data: new Uint8Array(pdfBytes),
      useSystemFonts: true,
      canvasFactory: factory,
    })
    .promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvasAndContext = factory.create(viewport.width, viewport.height);
  await page.render({
    canvasContext: canvasAndContext.context,
    viewport,
    canvasFactory: factory,
  }).promise;
  const png = canvasAndContext.canvas.toBuffer("image/png");
  return `node-canvas-factory OK ${canvasAndContext.canvas.width}x${canvasAndContext.canvas.height} png=${png.length}`;
}

async function main() {
  const path = "data/light-performance-calibration/validation-reports/GIA-2496027047.pdf";
  try {
    console.log(await tryNodeCanvasFactory(path));
  } catch (e) {
    console.log("FAIL", e instanceof Error ? e.message : e);
    if (e instanceof Error) console.log(e.stack?.split("\n").slice(0, 8).join("\n"));
  }
}

main().catch(console.error);
