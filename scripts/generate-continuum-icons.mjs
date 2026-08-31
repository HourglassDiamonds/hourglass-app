/**
 * Continuum PWA icons from the approved Continuum master.
 * Normal / Apple-touch icons are resized only.
 * Maskable is the same artwork on black, inset so the gold outer border
 * survives OS circle and squircle masking.
 *
 * Run: node scripts/generate-continuum-icons.mjs
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MASTER_NAME = "continuum-app-icon-1024.png";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "public", "continuum", MASTER_NAME);
const outDir = join(root, "public", "continuum");
const BLACK = { r: 0, g: 0, b: 0, alpha: 1 };

if (basename(source) !== MASTER_NAME) {
  throw new Error("Continuum icons must be generated from the approved master");
}

// Maskable safe zone is a centered circle of 80% diameter.
// Keep the full square (including the gold frame) inside that circle.
const MASKABLE_SAFE_DIAMETER = 0.8;
const MASKABLE_INSET_RATIO = (1 - MASKABLE_SAFE_DIAMETER / Math.SQRT2) / 2;

async function resizeOnly(size) {
  return sharp(source)
    .resize(size, size, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 });
}

async function maskableOnBlack(size) {
  const inset = Math.round(size * MASKABLE_INSET_RATIO);
  const inner = Math.max(1, size - inset * 2);
  const artwork = await sharp(source)
    .resize(inner, inner, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BLACK,
    },
  })
    .composite([{ input: artwork, top: inset, left: inset }])
    .png({ compressionLevel: 9 });
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  await (await resizeOnly(192)).toFile(join(outDir, "icon-192.png"));
  await (await resizeOnly(512)).toFile(join(outDir, "icon-512.png"));
  await (await maskableOnBlack(512)).toFile(
    join(outDir, "icon-maskable-512.png"),
  );
  await (await resizeOnly(180)).toFile(join(outDir, "apple-touch-icon.png"));
  console.log(
    `Wrote public/continuum icons from ${MASTER_NAME} (192, 512, maskable-512, apple-180)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
