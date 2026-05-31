/**
 * LGDR / GIA diagram band forensics — saves rendered page + band crops + OCR variants.
 * Usage: npx tsx scripts/lgdr-diagram-forensics.ts [reportId]
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  GIA_DIAGRAM_VALUE_BANDS,
  GIA_LGDR_DOSSIER_VALUE_BANDS,
  extractGiaProportionDiagram,
  type GiaDiagramLayout,
} from "@/lib/calibration-library/parsers/gia/gia-diagram-extraction";
import {
  isOcrRuntimeAvailable,
  ocrImageBuffer,
  renderPdfPagePngAtScale,
} from "@/lib/calibration-library/ocr";

const REPORT_ID = process.argv[2]?.trim() || "2496027047";
const PDF_PATH = join(
  "data/light-performance-calibration/validation-reports",
  `GIA-${REPORT_ID}.pdf`,
);
const OUT_DIR = join(
  "data/light-performance-calibration/debug/gia",
  REPORT_ID,
);

type Preprocess = "raw" | "contrast" | "threshold";

async function preprocessCropPng(
  png: Buffer,
  mode: Preprocess,
): Promise<Buffer> {
  if (mode === "raw") return png;
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
}

async function cropRegionPng(
  pagePng: Buffer,
  pageW: number,
  pageH: number,
  crop: { left: number; top: number; width: number; height: number },
): Promise<{ png: Buffer; width: number; height: number } | null> {
  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  const img = await loadImage(pagePng);
  const sx = Math.max(0, Math.floor(crop.left * pageW));
  const sy = Math.max(0, Math.floor(crop.top * pageH));
  const w = Math.max(1, Math.min(pageW - sx, Math.floor(crop.width * pageW)));
  const h = Math.max(1, Math.min(pageH - sy, Math.floor(crop.height * pageH)));
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
  return { png: canvas.toBuffer("image/png"), width: w, height: h };
}

async function probeLayout(
  layout: GiaDiagramLayout,
  pdf: Buffer,
  scale: number,
): Promise<void> {
  const bands =
    layout === "lgdr-dossier"
      ? GIA_LGDR_DOSSIER_VALUE_BANDS
      : GIA_DIAGRAM_VALUE_BANDS;
  const layoutDir = join(OUT_DIR, layout, `scale-${scale}`);
  mkdirSync(layoutDir, { recursive: true });

  const rendered = await renderPdfPagePngAtScale(pdf, 1, scale);
  if (!rendered) {
    console.log(`[${layout} scale=${scale}] RENDER FAIL`);
    return;
  }
  writeFileSync(join(layoutDir, "page-full.png"), rendered.png);
  console.log(
    `[${layout} scale=${scale}] page ${rendered.width}x${rendered.height} backend=${rendered.backend}`,
  );

  for (const band of bands) {
    const cropped = await cropRegionPng(
      rendered.png,
      rendered.width,
      rendered.height,
      band.crop,
    );
    if (!cropped) continue;
    const bandDir = join(layoutDir, band.id);
    mkdirSync(bandDir, { recursive: true });
    writeFileSync(join(bandDir, "crop-raw.png"), cropped.png);

    const variants: Preprocess[] = ["raw", "threshold", "contrast"];
    const ocrRows: string[] = [];
    for (const prep of variants) {
      const prepped = await preprocessCropPng(cropped.png, prep);
      writeFileSync(join(bandDir, `crop-${prep}.png`), prepped);
      const ocr = await ocrImageBuffer(prepped);
      ocrRows.push(`  [${prep}] ${ocr.text.replace(/\s+/g, " ").slice(0, 120)}`);
    }
    console.log(
      `  band=${band.id} crop=${Math.round(band.crop.left * 100)}%/${Math.round(band.crop.top * 100)}% ${cropped.width}x${cropped.height}`,
    );
    for (const row of ocrRows) console.log(row);
  }
}

async function main(): Promise<void> {
  if (!(await isOcrRuntimeAvailable())) {
    console.error("OCR not available");
    process.exit(1);
  }
  const pdf = readFileSync(PDF_PATH);
  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`LGDR forensics — ${REPORT_ID}`);
  for (const scale of [5, 6]) {
    await probeLayout("facsimile", pdf, scale);
    await probeLayout("lgdr-dossier", pdf, scale);
  }

  console.log("\n--- extractGiaProportionDiagram (tryLayouts) ---");
  const report = await extractGiaProportionDiagram(pdf, { tryLayouts: true });
  console.log(`located=${report.diagramLocated} reason=${report.locateReason}`);
  for (const f of report.fields) {
    console.log(
      `  ${f.field}: ${f.parsedValue ?? "—"} [${f.confidence}] band=${f.bandId ?? "—"} note=${f.note}`,
    );
    if (f.ocrText.trim()) {
      console.log(`    ocr: ${f.ocrText.replace(/\s+/g, " ").slice(0, 100)}`);
    }
  }
  writeFileSync(
    join(OUT_DIR, "extraction-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(`\nSaved to ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
