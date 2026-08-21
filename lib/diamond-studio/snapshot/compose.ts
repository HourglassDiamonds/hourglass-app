/**
 * Deterministic Studio snapshot compositor.
 *
 * Canonical path: compose source finger/band + diamond PNGs with the same
 * face-dimension / CAD / ring-cluster math as the live desktop stage.
 * Not a DOM screenshot.
 */

import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import type { DiamondStudioConfiguration } from "@/lib/diamond-studio/configuration";
import { formatStudioCardCopy } from "@/lib/diamond-studio/configuration";
import {
  CLEAN_SNAPSHOT_HEIGHT,
  CLEAN_SNAPSHOT_WIDTH,
  FINGER_OBJECT_POSITION,
  computeCanonicalSnapshotLayout,
  type CanonicalSnapshotLayout,
} from "@/lib/diamond-studio/stage-calibration";
import {
  bandAssetFilesystemPath,
  diamondAssetFilesystemPath,
} from "@/lib/diamond-studio/snapshot/assets";
import {
  CARD_COLORS,
  CARD_FOOTER_TOP,
  CARD_HEIGHT,
  CARD_MARGIN,
  CARD_VIZ_HEIGHT,
  CARD_VIZ_TOP,
  CARD_VIZ_WIDTH,
  CARD_WIDTH,
  CARD_WORDMARK_TOP,
} from "@/lib/diamond-studio/snapshot/card";

export type StudioSnapshotResult = {
  mimeType: "image/jpeg";
  width: number;
  height: number;
  buffer: Buffer;
  variant: "clean" | "card";
};

type ImageLike = Awaited<ReturnType<typeof loadImage>>;

function drawCover(
  ctx: SKRSContext2D,
  img: ImageLike,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  posX: number,
  posY: number,
) {
  const scale = Math.max(dw / img.width, dh / img.height);
  const sw = img.width * scale;
  const sh = img.height * scale;
  const ox = dx + (dw - sw) * posX;
  const oy = dy + (dh - sh) * posY;
  ctx.drawImage(img, ox, oy, sw, sh);
}

function drawContain(
  ctx: SKRSContext2D,
  img: ImageLike,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const scale = Math.min(dw / img.width, dh / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, dx + (dw - w) / 2, dy + (dh - h) / 2, w, h);
}

function drawFingerLayer(
  ctx: SKRSContext2D,
  finger: ImageLike,
  layout: CanonicalSnapshotLayout,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, layout.viewerWidth, layout.viewerHeight);
  ctx.clip();
  drawCover(
    ctx,
    finger,
    0,
    layout.fingerTranslateYPx,
    layout.viewerWidth,
    layout.viewerHeight,
    FINGER_OBJECT_POSITION.x,
    FINGER_OBJECT_POSITION.y,
  );
  ctx.restore();
}

function drawDiamondLayer(
  ctx: SKRSContext2D,
  diamond: ImageLike,
  layout: CanonicalSnapshotLayout,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, layout.viewerWidth, layout.viewerHeight);
  ctx.clip();

  ctx.translate(layout.layerLeftPx, layout.layerTopPx);

  const originX = layout.cadCenterX * layout.layerWidthPx;
  const originY = layout.cadCenterY * layout.layerHeightPx;
  ctx.translate(originX, originY);
  ctx.scale(layout.cadVisibleScale, layout.cadVisibleScale);
  ctx.translate(-originX, -originY);

  if (layout.cadClipRound) {
    const radius =
      0.495 * Math.sqrt(layout.layerWidthPx ** 2 + layout.layerHeightPx ** 2) /
      Math.SQRT2;
    ctx.beginPath();
    ctx.arc(originX, originY, radius, 0, Math.PI * 2);
    ctx.clip();
  }

  if (layout.orientation === "ew") {
    ctx.translate(layout.layerWidthPx / 2, layout.layerHeightPx / 2);
    ctx.rotate(Math.PI / 2);
    ctx.translate(-layout.layerWidthPx / 2, -layout.layerHeightPx / 2);
  }

  drawContain(ctx, diamond, 0, 0, layout.layerWidthPx, layout.layerHeightPx);
  ctx.restore();
}

type SnapshotCanvas = {
  toBuffer(mime: "image/png" | "image/jpeg", quality?: number): Buffer;
  width: number;
  height: number;
};

async function renderVisualizationCanvas(
  config: DiamondStudioConfiguration,
): Promise<SnapshotCanvas> {
  const layout = computeCanonicalSnapshotLayout(config);
  const canvas = createCanvas(layout.viewerWidth, layout.viewerHeight);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = CARD_COLORS.ivory;
  ctx.fillRect(0, 0, layout.viewerWidth, layout.viewerHeight);

  const finger = await loadImage(
    bandAssetFilesystemPath(config.skinTone, config.bandWidth, config.metal),
  );
  const diamond = await loadImage(diamondAssetFilesystemPath(config.shape));

  drawFingerLayer(ctx, finger, layout);
  drawDiamondLayer(ctx, diamond, layout);
  return canvas;
}

function encodeJpeg(canvas: SnapshotCanvas, quality = 90): Buffer {
  return canvas.toBuffer("image/jpeg", quality);
}

export async function composeCleanStudioSnapshot(
  config: DiamondStudioConfiguration,
): Promise<StudioSnapshotResult> {
  const canvas = await renderVisualizationCanvas(config);
  return {
    mimeType: "image/jpeg",
    width: CLEAN_SNAPSHOT_WIDTH,
    height: CLEAN_SNAPSHOT_HEIGHT,
    buffer: encodeJpeg(canvas),
    variant: "clean",
  };
}

function fillTrackedText(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
) {
  let cursor = x;
  for (const character of text) {
    ctx.fillText(character, cursor, y);
    cursor += ctx.measureText(character).width + tracking;
  }
}

function drawBrandedCard(
  viz: SnapshotCanvas,
  config: DiamondStudioConfiguration,
): SnapshotCanvas {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = CARD_COLORS.ivory;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.fillStyle = CARD_COLORS.gold;
  ctx.textBaseline = "top";
  ctx.font = "500 13px Arial, Helvetica, sans-serif";
  fillTrackedText(
    ctx,
    "HOURGLASS DIAMONDS",
    CARD_MARGIN,
    CARD_WORDMARK_TOP,
    3.2,
  );

  const vizX = CARD_MARGIN;
  const vizY = CARD_VIZ_TOP;
  ctx.drawImage(
    viz as Parameters<SKRSContext2D["drawImage"]>[0],
    vizX,
    vizY,
    CARD_VIZ_WIDTH,
    CARD_VIZ_HEIGHT,
  );

  const copy = formatStudioCardCopy(config);

  ctx.fillStyle = CARD_COLORS.ink;
  ctx.font = '400 42px "Times New Roman", Times, Georgia, serif';
  ctx.fillText(copy.headline, CARD_MARGIN, CARD_FOOTER_TOP);

  ctx.fillStyle = CARD_COLORS.muted;
  ctx.font = "400 20px Arial, Helvetica, sans-serif";
  ctx.fillText(copy.detail, CARD_MARGIN, CARD_FOOTER_TOP + 50);

  if (copy.orientationLine) {
    ctx.font = "400 16px Arial, Helvetica, sans-serif";
    ctx.fillText(copy.orientationLine, CARD_MARGIN, CARD_FOOTER_TOP + 76);
  }

  return canvas;
}

export async function composeBrandedShareCard(
  config: DiamondStudioConfiguration,
): Promise<StudioSnapshotResult> {
  const viz = await renderVisualizationCanvas(config);
  const card = drawBrandedCard(viz, config);
  return {
    mimeType: "image/jpeg",
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    buffer: encodeJpeg(card),
    variant: "card",
  };
}

export async function composeStudioSnapshot(
  config: DiamondStudioConfiguration,
  variant: "clean" | "card",
): Promise<StudioSnapshotResult> {
  return variant === "card"
    ? composeBrandedShareCard(config)
    : composeCleanStudioSnapshot(config);
}

/** PNG for calibration tests — lossless, not the share payload. */
export async function composeCleanStudioSnapshotPng(
  config: DiamondStudioConfiguration,
): Promise<{ width: number; height: number; buffer: Buffer }> {
  const canvas = await renderVisualizationCanvas(config);
  return {
    width: CLEAN_SNAPSHOT_WIDTH,
    height: CLEAN_SNAPSHOT_HEIGHT,
    buffer: canvas.toBuffer("image/png"),
  };
}

export async function composeFingerOnlyPng(
  config: DiamondStudioConfiguration,
): Promise<{ width: number; height: number; buffer: Buffer }> {
  const layout = computeCanonicalSnapshotLayout(config);
  const canvas = createCanvas(layout.viewerWidth, layout.viewerHeight);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = CARD_COLORS.ivory;
  ctx.fillRect(0, 0, layout.viewerWidth, layout.viewerHeight);
  const finger = await loadImage(
    bandAssetFilesystemPath(config.skinTone, config.bandWidth, config.metal),
  );
  drawFingerLayer(ctx, finger, layout);
  return {
    width: layout.viewerWidth,
    height: layout.viewerHeight,
    buffer: canvas.toBuffer("image/png"),
  };
}
