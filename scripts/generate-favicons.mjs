/**
 * Generates site favicons from public/hourglass-logo-gold.png
 * Run: node scripts/generate-favicons.mjs
 */
import sharp from "sharp";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "public", "hourglass-logo-gold.png");
const outDir = join(root, "public");

/** Matches site background — keeps logo readable at small sizes */
const BG = { r: 247, g: 243, b: 238, alpha: 1 };

async function renderPng(size, filename) {
  const out = join(outDir, filename);
  await sharp(source)
    .resize(size, size, {
      fit: "contain",
      background: BG,
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`Wrote ${filename}`);
}

async function main() {
  await renderPng(16, "favicon-16x16.png");
  await renderPng(32, "favicon-32x32.png");
  await renderPng(180, "apple-touch-icon.png");

  const buf16 = await sharp(join(outDir, "favicon-16x16.png")).toBuffer();
  const buf32 = await sharp(join(outDir, "favicon-32x32.png")).toBuffer();

  const { default: toIco } = await import("to-ico");
  const ico = await toIco([buf16, buf32]);
  writeFileSync(join(outDir, "favicon.ico"), ico);
  writeFileSync(join(root, "app", "favicon.ico"), ico);
  console.log("Wrote favicon.ico (public + app)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
