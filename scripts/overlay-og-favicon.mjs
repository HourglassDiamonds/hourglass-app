/**
 * Overlays the Hourglass favicon mark onto the ring-studio OG image.
 * Run: node scripts/overlay-og-favicon.mjs
 */
import sharp from "sharp";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ogDir = join(root, "public", "og");
const baseOg = join(ogDir, "hourglass-diamonds-og-ring-studio.png");
const markSource = join(root, "public", "apple-touch-icon.png");

const LEFT = 56;
const TOP = 42;
const PATCH_BG = { r: 240, g: 234, b: 227, alpha: 1 };

const variants = [
  { height: 72, out: join(ogDir, "hourglass-diamonds-og-ring-studio-d.png") },
  { height: 84, out: join(ogDir, "hourglass-diamonds-og-ring-studio-e.png") },
  { height: 84, out: baseOg },
  { height: 96, out: join(ogDir, "hourglass-diamonds-og-ring-studio-f.png") },
];

async function cleanMarkRegion(baseBuffer) {
  const meta = await sharp(baseBuffer).metadata();
  const patchW = 130;
  const patchH = 120;

  const patch = await sharp({
    create: {
      width: patchW,
      height: patchH,
      channels: 4,
      background: PATCH_BG,
    },
  })
    .png()
    .toBuffer();

  return sharp(baseBuffer)
    .composite([{ input: patch, left: LEFT - 8, top: TOP - 6 }])
    .png()
    .toBuffer();
}

async function overlayMark(baseBuffer, markHeight, outPath) {
  const mark = await sharp(markSource)
    .resize(null, markHeight, {
      fit: "contain",
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();

  const markMeta = await sharp(mark).metadata();

  await sharp(baseBuffer)
    .composite([
      {
        input: mark,
        left: LEFT,
        top: TOP,
      },
    ])
    .png()
    .toFile(outPath);

  console.log(
    `Wrote ${outPath} (mark ${markMeta.width}x${markMeta.height} at ${LEFT},${TOP})`,
  );
}

async function main() {
  const sourceBuffer = readFileSync(baseOg);
  const cleanBase = await cleanMarkRegion(sourceBuffer);

  for (const { height, out } of variants) {
    await overlayMark(cleanBase, height, out);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
