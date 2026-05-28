import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const pdfPath =
  process.argv[2] ??
  "data/light-performance-calibration/uploads/1779553658775-G1360796191.pdf";
const bytes = readFileSync(pdfPath);

async function main() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  console.log("numPages", doc.numPages);

  const outDir = join(process.cwd(), "data/light-performance-calibration/debug/gcal/LG360796191");
  mkdirSync(outDir, { recursive: true });

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const ops = await page.getOperatorList();
    let imgCount = 0;
    for (let i = 0; i < ops.fnArray.length; i++) {
      if (ops.fnArray[i] !== pdfjs.OPS.paintImageXObject) continue;
      const name = ops.argsArray[i]?.[0];
      if (!name) continue;
      try {
        const img = await page.objs.get(name);
        const data = img?.bitmap ?? img?.data ?? img;
        if (!data) {
          console.log(`page ${p} img ${name}: no data`, Object.keys(img ?? {}));
          continue;
        }
        const { createCanvas } = await import("@napi-rs/canvas");
        const w = img.width ?? data.width;
        const h = img.height ?? data.height;
        if (!w || !h) {
          console.log(`page ${p} img ${name}:`, img);
          continue;
        }
        const canvas = createCanvas(w, h);
        const ctx = canvas.getContext("2d");
        const imageData = ctx.createImageData(w, h);
        const src = data.data ?? data;
        imageData.data.set(src);
        ctx.putImageData(imageData, 0, 0);
        const file = join(outDir, `page${p}-img${imgCount}-${String(name).replace(/\W/g, "")}.png`);
        writeFileSync(file, canvas.toBuffer("image/png"));
        console.log("saved", file, `${w}x${h}`);
        imgCount++;
      } catch (e) {
        console.log(`page ${p} img ${name} err`, e instanceof Error ? e.message : e);
      }
    }
    console.log(`page ${p} images`, imgCount);
  }
}

main();
