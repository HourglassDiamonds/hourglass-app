/**
 * Generates /public/og/diamond-studio-og.jpg from a live Diamond Studio screenshot.
 * Run: node scripts/generate-diamond-studio-og.mjs
 */
import { chromium } from "playwright";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import sharp from "sharp";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "og");
const tmpDir = join(root, "scripts", ".og-tmp");

const W = 1200;
const H = 630;
const LEFT_W = Math.round(W * 0.4);
const RIGHT_W = W - LEFT_W;

const BG = "#F8F6F2";
const TEXT = "#1F1F1F";
const ACCENT = "#B79B6C";

const STUDIO_URL = process.env.DIAMOND_STUDIO_OG_URL ?? "http://localhost:3000/diamond-studio";

mkdirSync(outDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

async function captureStudioScreenshot() {
  const screenshotPath = join(tmpDir, "diamond-studio-screenshot.png");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    await page.goto(STUDIO_URL, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForSelector("[data-diamond-studio-route]", { timeout: 30_000 });
    await page.waitForTimeout(1200);

    const route = page.locator("[data-diamond-studio-route]");
    await route.screenshot({ path: screenshotPath, type: "png" });
    console.log(`Captured screenshot: ${screenshotPath}`);
    return screenshotPath;
  } finally {
    await browser.close();
  }
}

async function roundedScreenshot(inputPath, width, height, radius) {
  const resized = await sharp(inputPath)
    .resize(width, height, { fit: "cover", position: "center" })
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

async function composeOgImage(screenshotPath) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  drawGeometricAccent(ctx);

  const logo = await loadImage(join(root, "public", "favicon-32x32.png"));
  const logoSize = 28;
  ctx.drawImage(logo, 56, 52, logoSize, logoSize);

  const textX = 56;
  const textMax = LEFT_W - 72;

  ctx.fillStyle = TEXT;
  ctx.font = '400 58px "Times New Roman", Times, Georgia, serif';
  ctx.textBaseline = "top";
  const headlineEndY = wrapText(ctx, "Diamond Size Studio", textX, 112, textMax, 64);

  ctx.font = '400 21px "Times New Roman", Times, Georgia, serif';
  const subY = wrapText(
    ctx,
    "See how a diamond looks on your finger before you buy.",
    textX,
    headlineEndY + 36,
    textMax,
    30,
  );

  ctx.fillStyle = "rgba(31, 31, 31, 0.62)";
  ctx.font = '400 14px Arial, Helvetica, sans-serif';
  wrapText(
    ctx,
    "Compare shapes, carat weights, and finger sizes in true scale.",
    textX,
    subY + 34,
    textMax,
    20,
  );

  ctx.fillStyle = "rgba(31, 31, 31, 0.55)";
  ctx.font = '400 11px Arial, Helvetica, sans-serif';
  ctx.letterSpacing = "0.14em";
  ctx.fillText("hourglassdiamonds.com", textX, H - 48);

  const shotW = RIGHT_W - 88;
  const shotH = H - 96;
  const shotX = LEFT_W + 32;
  const shotY = 48;
  const radius = 24;

  const rounded = await roundedScreenshot(screenshotPath, shotW, shotH, radius);
  const shotImg = await loadImage(rounded);

  ctx.save();
  ctx.shadowColor = "rgba(31, 31, 31, 0.12)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 10;
  ctx.drawImage(shotImg, shotX, shotY, shotW, shotH);
  ctx.restore();

  ctx.strokeStyle = "rgba(31, 31, 31, 0.06)";
  ctx.lineWidth = 1;
  roundRect(ctx, shotX + 0.5, shotY + 0.5, shotW - 1, shotH - 1, radius);
  ctx.stroke();

  const outPath = join(outDir, "diamond-studio-og.jpg");
  const pngBuffer = canvas.toBuffer("image/png");
  await sharp(pngBuffer)
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(outPath);

  const meta = await sharp(outPath).metadata();
  console.log(`Wrote ${outPath} (${meta.width}x${meta.height})`);
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

async function main() {
  const screenshotPath = await captureStudioScreenshot();
  await composeOgImage(screenshotPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
