/**
 * One-off GIA facsimile crop probe — npm run debug:gia-crops
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { ANCHOR_PDF_SPECS, resolveAnchorPdfPath } from "../lib/calibration-library/anchor-pdf-paths";
import { renderPdfPagePngAtScale } from "../lib/calibration-library/ocr";
import { ocrImageBuffer } from "../lib/calibration-library/ocr";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  GIA_FACSIMILE_GRADING_PANEL_CROP,
  GIA_FACSIMILE_INLINE_RESULTS_CROP,
  GIA_FACSIMILE_DIAGRAM_CROP,
  ocrGiaFacsimileDiagramRegion,
} from "../lib/calibration-library/parsers/gia/gia-facsimile-image-ocr";
import { probeGiaLiveFieldCandidates } from "../lib/calibration-library/gia-proportions";

async function main() {
  const spec = ANCHOR_PDF_SPECS.find((s) => s.reportNumber === "2527039693")!;
  const path = resolveAnchorPdfPath(spec)!;
  const pdf = readFileSync(path);
  const doc = await getDocument({ data: new Uint8Array(pdf), useSystemFonts: true }).promise;
  console.log("pages", doc.numPages, "path", path);

  const ocr = await ocrGiaFacsimileDiagramRegion(pdf);
  console.log("\n--- ocrGiaFacsimileDiagramRegion ---");
  console.log("ok", ocr.ok, "len", ocr.text.length);
  console.log("crops", ocr.cropTexts.length);
  for (let i = 0; i < ocr.cropTexts.length; i++) {
    console.log(`\n[crop ${i}]`, ocr.cropTexts[i]?.slice(0, 400));
  }
  const probe = probeGiaLiveFieldCandidates(ocr.text, "36.5");
  console.log("\nprobe from crop union:", probe);

  const crops = [
    ["grading", GIA_FACSIMILE_GRADING_PANEL_CROP],
    ["inline", GIA_FACSIMILE_INLINE_RESULTS_CROP],
    ["diagram", GIA_FACSIMILE_DIAGRAM_CROP],
  ] as const;

  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  const r1 = await renderPdfPagePngAtScale(pdf, 1, 5);
  if (!r1) return;
  const img = await loadImage(r1.png);
  const trial = [
    { name: "stack", left: 0.52, top: 0.28, w: 0.44, h: 0.22 },
    { name: "grading-results", left: 0.05, top: 0.45, w: 0.48, h: 0.32 },
    { name: "grading-results-high", left: 0.06, top: 0.38, w: 0.46, h: 0.38 },
    { name: "left-mid", left: 0.06, top: 0.52, w: 0.42, h: 0.28 },
    { name: "stack-tall", left: 0.48, top: 0.28, w: 0.5, h: 0.42 },
    { name: "left-lower", left: 0.04, top: 0.58, w: 0.5, h: 0.24 },
  ];
  const fullRaw = (await ocrImageBuffer(r1.png)).text;
  const dbgDir = join(process.cwd(), "data/light-performance-calibration/debug/gia");
  mkdirSync(dbgDir, { recursive: true });
  writeFileSync(join(dbgDir, "2527039693-full-ocr.txt"), fullRaw);
  const full = fullRaw.toLowerCase();
  for (const w of ["girdle", "medium", "slightly", "slight", "faceted", "3.5", "thick", "thickn"]) {
    console.log("full-page has", w, full.includes(w));
  }
  for (const term of ["faceted", "3.5", "75%", "lower"]) {
    const i = full.indexOf(term);
    if (i >= 0) console.log(term, "ctx:", full.slice(Math.max(0, i - 30), i + 80));
  }

  for (const g of trial) {
    const sx = Math.floor(g.left * r1.width);
    const sy = Math.floor(g.top * r1.height);
    const w = Math.floor(g.w * r1.width);
    const h = Math.floor(g.h * r1.height);
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
    const t = (await ocrImageBuffer(canvas.toBuffer("image/png"))).text;
    const probe = probeGiaLiveFieldCandidates(t, "36.5");
    console.log(`\n[${g.name}] pav=${probe.pavilionCandidate} girdle=${probe.girdleCandidate}`);
    console.log(t.slice(0, 400).replace(/\n/g, " | "));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
