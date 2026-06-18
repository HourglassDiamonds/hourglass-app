/**
 * Generates /public/og/diamond-intelligence-og.jpg from the editorial background.
 * Run: node scripts/generate-diamond-intelligence-og.mjs
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
const LEFT_W = Math.round(W * 0.4);
const RIGHT_W = W - LEFT_W;

const BG = "#F8F6F2";
const TEXT = "#1F1F1F";
const ACCENT = "#B79B6C";

// Logo — same anchor as generate-diamond-studio-og.mjs (56, 52).
const LOGO_X = 56;
const LOGO_Y = 52;
const LOGO_SIZE = 60;

// Layout geometry — match generate-diamond-studio-og.mjs exactly.
const TEXT_X = 56;
const TEXT_MAX = LEFT_W - 72;
const SHOT_W = RIGHT_W - 88;
const SHOT_H = H - 96;
const SHOT_X = LEFT_W + 32;
const SHOT_Y = 48;
const SHOT_RADIUS = 24;

// Typography rhythm — spacing tuned to match diamond-studio-og.jpg visual cadence.
const HEADLINE_Y = 122;
const HEADLINE_SIZE = 58;
const HEADLINE_LEADING = 64;
const SUB_TO_BODY_GAP = 34;
const DIVIDER_AFTER_BLOCK_GAP = 18;
const DIVIDER_TO_SUB_GAP = 32;

const BACKGROUND_IMAGE = join(outDir, "hourglass-diamond-intelligence.png");
const LOGO_MARK_SOURCE = join(root, "public", "apple-touch-icon.png");

mkdirSync(outDir, { recursive: true });

async function roundedBackground(inputPath, width, height, radius) {
  const resized = await sharp(inputPath)
    .resize(width, height, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  const mask = Buffer.from(
    `<svg width="${width}" height="${height}">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="white"/>
    </svg>`,
  );

  return sharp(resized)
    .composite([{ input: await sharp(mask).png().toBuffer(), blend: "dest-in" }])
    .png()
    .toBuffer();
}

function drawGeometricAccent(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1;

  const cx = LEFT_W * 0.72;
  const cy = H * 0.42;
  const size = 280;

  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.5);
  ctx.lineTo(cx + size * 0.28, cy - size * 0.12);
  ctx.lineTo(cx + size * 0.28, cy + size * 0.12);
  ctx.lineTo(cx, cy + size * 0.5);
  ctx.lineTo(cx - size * 0.28, cy + size * 0.12);
  ctx.lineTo(cx - size * 0.28, cy - size * 0.12);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.22);
  ctx.lineTo(cx, cy + size * 0.22);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - size * 0.16, cy);
  ctx.lineTo(cx + size * 0.16, cy);
  ctx.stroke();

  ctx.restore();
}

function drawHeadlineBlock(ctx, lines, x, y, fontSize, lineHeight) {
  ctx.fillStyle = TEXT;
  ctx.font = `400 ${fontSize}px "Times New Roman", Times, Georgia, serif`;
  ctx.textBaseline = "top";

  let lastLineY = y;
  let cursorY = y;
  for (const line of lines) {
    lastLineY = cursorY;
    ctx.fillText(line, x, cursorY);
    cursorY += lineHeight;
  }

  return lastLineY;
}

function drawGoldDivider(ctx, x, y, width) {
  const centerX = x + width / 2;
  const gemRadius = 6.5;
  const gap = 10;

  ctx.save();
  ctx.strokeStyle = ACCENT;
  ctx.fillStyle = ACCENT;
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(centerX - gap, y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(centerX + gap, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(centerX, y - gemRadius);
  ctx.lineTo(centerX + gemRadius * 0.72, y);
  ctx.lineTo(centerX, y + gemRadius);
  ctx.lineTo(centerX - gemRadius * 0.72, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let cursorY = y;

  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = words[i];
      cursorY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
  return cursorY;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function composeOgImage() {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  drawGeometricAccent(ctx);

  const logo = await loadImage(LOGO_MARK_SOURCE);
  ctx.drawImage(logo, LOGO_X, LOGO_Y, LOGO_SIZE, LOGO_SIZE);

  const textX = TEXT_X;
  const textMax = TEXT_MAX;

  const headlineEndY = drawHeadlineBlock(
    ctx,
    ["Diamond", "Intelligence"],
    textX,
    HEADLINE_Y,
    HEADLINE_SIZE,
    HEADLINE_LEADING,
  );

  const headlineBlockBottom = headlineEndY + HEADLINE_LEADING;
  const dividerY = headlineBlockBottom + DIVIDER_AFTER_BLOCK_GAP;
  drawGoldDivider(ctx, textX, dividerY, textMax);

  ctx.fillStyle = TEXT;
  ctx.font = '400 24px "Times New Roman", Times, Georgia, serif';
  ctx.textBaseline = "top";
  const subY = wrapText(
    ctx,
    "Beyond the Report.",
    textX,
    dividerY + DIVIDER_TO_SUB_GAP,
    textMax,
    30,
  );

  ctx.fillStyle = TEXT;
  ctx.font = '400 21px "Times New Roman", Times, Georgia, serif';
  wrapText(
    ctx,
    "Evaluate light performance, optical precision, and overall diamond quality with expert-guided analysis.",
    textX,
    subY + SUB_TO_BODY_GAP,
    textMax,
    30,
  );

  ctx.fillStyle = "rgba(31, 31, 31, 0.55)";
  ctx.font = '400 11px Arial, Helvetica, sans-serif';
  ctx.letterSpacing = "0.14em";
  ctx.fillText("hourglassdiamonds.com", textX, H - 48);

  const rounded = await roundedBackground(BACKGROUND_IMAGE, SHOT_W, SHOT_H, SHOT_RADIUS);
  const shotImg = await loadImage(rounded);

  ctx.save();
  ctx.shadowColor = "rgba(31, 31, 31, 0.12)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 10;
  ctx.drawImage(shotImg, SHOT_X, SHOT_Y, SHOT_W, SHOT_H);
  ctx.restore();

  ctx.strokeStyle = "rgba(31, 31, 31, 0.06)";
  ctx.lineWidth = 1;
  roundRect(ctx, SHOT_X + 0.5, SHOT_Y + 0.5, SHOT_W - 1, SHOT_H - 1, SHOT_RADIUS);
  ctx.stroke();

  const outPath = join(outDir, "diamond-intelligence-og.jpg");
  const pngBuffer = canvas.toBuffer("image/png");
  await sharp(pngBuffer)
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(outPath);

  const meta = await sharp(outPath).metadata();
  console.log(`Wrote ${outPath} (${meta.width}x${meta.height})`);
}

composeOgImage().catch((err) => {
  console.error(err);
  process.exit(1);
});
