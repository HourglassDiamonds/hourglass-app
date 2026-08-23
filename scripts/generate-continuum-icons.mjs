/**
 * Temporary Continuum PWA icons from the existing gold Hourglass mark.
 * Output names are stable so final artwork can replace these files in place.
 *
 * Run: node scripts/generate-continuum-icons.mjs
 */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "public", "hourglass-logo-gold.png");
const outDir = join(root, "public", "continuum");
const BG = { r: 20, g: 17, b: 15, alpha: 1 };

async function markOnCanvas(size, insetRatio) {
  const inset = Math.round(size * insetRatio);
  const inner = Math.max(1, size - inset * 2);
  const mark = await sharp(source)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: mark, top: inset, left: inset }])
    .png({ compressionLevel: 9 });
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  await (await markOnCanvas(192, 0.16)).toFile(join(outDir, "icon-192.png"));
  await (await markOnCanvas(512, 0.16)).toFile(join(outDir, "icon-512.png"));
  await (await markOnCanvas(512, 0.22)).toFile(
    join(outDir, "icon-maskable-512.png"),
  );
  await (await markOnCanvas(180, 0.14)).toFile(
    join(outDir, "apple-touch-icon.png"),
  );
  console.log("Wrote public/continuum icons (192, 512, maskable-512, apple-180)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
