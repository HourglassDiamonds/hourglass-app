/**
 * Generates /public/og/hourglass-diamonds-og.jpg — canonical homepage OG image.
 * Run: node scripts/generate-homepage-og.mjs
 */
import { createCanvas, loadImage } from "@napi-rs/canvas";
import sharp from "sharp";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "og");

const W = 1200;
const H = 630;

const IVORY = "#F8F6F2";
const GOLD = "#B79B6C";

const CONTENT_LEFT = 64;
const CONTENT_MAX_W = 420;

// Headline — fixed editorial placement (preserves prior composition).
const HEADLINE_Y = 210;
const HEADLINE_LINES = [
  "A More Personal House",
  "of Engagement & Jewelry Design.",
];
const HEADLINE_SIZE = 45;
const HEADLINE_LEADING = 51;

const DIVIDER_WIDTH = Math.round(CONTENT_MAX_W * 0.68);
const DIVIDER_GAP_AFTER_HEADLINE = 22;
const DIVIDER_TO_BODY_GAP = 22;

const BODY_LINES = [
  "Expert diamond guidance.",
  "Custom engagement rings.",
  "Thoughtful design.",
];
const BODY_SIZE = 16;
const BODY_LEADING = 28;

// Footer — bottom center, muted gold editorial signature.
const FOOTER_TEXT = "WWW.HOURGLASSDIAMONDS.COM";
const FOOTER_SIZE = 10;
const FOOTER_Y = H - 46;

// Background — zoom in on diamond (right-anchored).
const BACKGROUND_ZOOM = 1.18;

const BACKGROUND_IMAGE = join(outDir, "HGD-landing-OG.png");
const OUT_PATH = join(outDir, "hourglass-diamonds-og.jpg");

const SERIF = '"Georgia", "Times New Roman", Times, serif';
const SANS = '"Inter", "Segoe UI", Arial, Helvetica, sans-serif';

mkdirSync(outDir, { recursive: true });

async function loadBackground() {
  const zoomW = Math.round(W * BACKGROUND_ZOOM);
  const zoomH = Math.round(H * BACKGROUND_ZOOM);

  return sharp(BACKGROUND_IMAGE)
    .resize(zoomW, zoomH, { fit: "cover", position: "right" })
    .extract({
      left: zoomW - W,
      top: Math.round((zoomH - H) / 2),
      width: W,
      height: H,
    })
    .png()
    .toBuffer();
}

function drawCharcoalOverlay(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, W, 0);
  gradient.addColorStop(0, "rgba(31, 31, 31, 0.82)");
  gradient.addColorStop(0.3, "rgba(31, 31, 31, 0.52)");
  gradient.addColorStop(0.48, "rgba(31, 31, 31, 0.22)");
  gradient.addColorStop(0.65, "rgba(31, 31, 31, 0.06)");
  gradient.addColorStop(0.8, "rgba(31, 31, 31, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
}

function drawHeadline(ctx, x, y) {
  ctx.fillStyle = IVORY;
  ctx.font = `400 ${HEADLINE_SIZE}px ${SERIF}`;
  ctx.textBaseline = "top";

  let cursorY = y;
  for (const line of HEADLINE_LINES) {
    ctx.fillText(line, x, cursorY);
    cursorY += HEADLINE_LEADING;
  }

  return cursorY;
}

function drawDivider(ctx, x, y, width) {
  ctx.save();
  ctx.strokeStyle = GOLD;
  ctx.globalAlpha = 0.72;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + 0.5);
  ctx.lineTo(x + width, y + 0.5);
  ctx.stroke();
  ctx.restore();
}

function drawBody(ctx, x, y) {
  ctx.fillStyle = "rgba(248, 246, 242, 0.86)";
  ctx.font = `400 ${BODY_SIZE}px ${SANS}`;
  ctx.textBaseline = "top";

  let cursorY = y;
  for (const line of BODY_LINES) {
    ctx.fillText(line, x, cursorY);
    cursorY += BODY_LEADING;
  }

  return cursorY;
}

function drawFooter(ctx) {
  ctx.save();
  ctx.font = `400 ${FOOTER_SIZE}px ${SANS}`;
  ctx.textBaseline = "top";
  ctx.letterSpacing = "0.18em";
  const textWidth = ctx.measureText(FOOTER_TEXT).width;
  const x = Math.round((W - textWidth) / 2);

  ctx.fillStyle = "rgba(31, 31, 31, 0.34)";
  ctx.fillText(FOOTER_TEXT, x + 0.5, FOOTER_Y + 0.5);

  ctx.fillStyle = "rgba(183, 155, 108, 0.72)";
  ctx.fillText(FOOTER_TEXT, x, FOOTER_Y);
  ctx.restore();
}

async function composeOgImage() {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const background = await loadBackground();
  const bgImg = await loadImage(background);
  ctx.drawImage(bgImg, 0, 0, W, H);

  drawCharcoalOverlay(ctx);

  let cursorY = HEADLINE_Y;
  const headlineBottom = drawHeadline(ctx, CONTENT_LEFT, cursorY);
  cursorY = headlineBottom + DIVIDER_GAP_AFTER_HEADLINE;

  drawDivider(ctx, CONTENT_LEFT, cursorY, DIVIDER_WIDTH);
  cursorY += 1 + DIVIDER_TO_BODY_GAP;

  drawBody(ctx, CONTENT_LEFT, cursorY);
  drawFooter(ctx);

  const pngBuffer = canvas.toBuffer("image/png");
  await sharp(pngBuffer)
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(OUT_PATH);

  const meta = await sharp(OUT_PATH).metadata();
  console.log(`Wrote ${OUT_PATH} (${meta.width}x${meta.height})`);
}

composeOgImage().catch((err) => {
  console.error(err);
  process.exit(1);
});
