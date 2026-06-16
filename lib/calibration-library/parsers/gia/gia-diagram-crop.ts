import type { RenderedPdfPage } from "../shared/ocr-utils";
import type { CropRegion, GiaDiagramBandDef } from "./gia-report-style";

export async function preprocessCropPng(
  png: Buffer,
  mode: GiaDiagramBandDef["preprocess"],
): Promise<Buffer> {
  if (mode === "raw") return png;
  try {
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const img = await loadImage(png);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = src.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
      const v =
        mode === "threshold"
          ? gray > 168
            ? 255
            : 0
          : Math.min(255, gray * 1.12 + 8);
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(src, 0, 0);
    return canvas.toBuffer("image/png");
  } catch {
    return png;
  }
}

export async function cropRegionPng(
  page: RenderedPdfPage,
  crop: CropRegion,
): Promise<{ png: Buffer; width: number; height: number } | null> {
  try {
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const img = await loadImage(page.png);
    const sx = Math.max(0, Math.floor(crop.left * page.width));
    const sy = Math.max(0, Math.floor(crop.top * page.height));
    const w = Math.max(
      1,
      Math.min(page.width - sx, Math.floor(crop.width * page.width)),
    );
    const h = Math.max(
      1,
      Math.min(page.height - sy, Math.floor(crop.height * page.height)),
    );
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
    return { png: canvas.toBuffer("image/png"), width: w, height: h };
  } catch {
    return null;
  }
}
