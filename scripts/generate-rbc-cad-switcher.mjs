/**
 * Crop rbc-cad-pop.png to visible stone bounds for the shape switcher thumbnail.
 *
 *   node scripts/generate-rbc-cad-switcher.mjs
 */
import path from "path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "public/diamond-tech-suite/diamonds/rbc-cad-pop.png");
const OUT = path.join(
  ROOT,
  "public/diamond-tech-suite/diamonds/rbc-cad-switcher.png",
);

const OUT_SIZE = 512;
const PAD_PX = 36;

async function main() {
  const trimmedBuf = await sharp(SRC).trim({ threshold: 12 }).png().toBuffer();
  const meta = await sharp(trimmedBuf).metadata();
  const pad = Math.min(
    PAD_PX,
    Math.round(Math.min(meta.width ?? OUT_SIZE, meta.height ?? OUT_SIZE) * 0.04),
  );

  const extendedBuf = await sharp(trimmedBuf)
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp(extendedBuf)
    .resize(OUT_SIZE, OUT_SIZE, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(OUT);

  const outMeta = await sharp(OUT).metadata();
  console.log(
    `Wrote ${OUT} (${outMeta.width}x${outMeta.height}, trim pad ${pad}px, trimmed source ${meta.width}x${meta.height})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
