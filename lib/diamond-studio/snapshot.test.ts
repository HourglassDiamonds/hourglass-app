import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { PNG } from "pngjs";
import type { DiamondStudioConfiguration } from "./configuration";
import {
  DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
  formatStudioCardCopy,
} from "./configuration";
import { expectedVisibleDiamondBox } from "./stage-calibration";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  composeBrandedShareCard,
  composeCleanStudioSnapshot,
  composeCleanStudioSnapshotPng,
  composeFingerOnlyPng,
} from "./snapshot";

const ARTIFACT_DIR = path.join(
  process.cwd(),
  "tmp",
  "diamond-studio-phase-b",
);

const QA_CONFIGS: Array<{ name: string; config: DiamondStudioConfiguration }> = [
  {
    name: "default-round-2.50",
    config: DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
  },
  {
    name: "white-round-3.00",
    config: {
      ...DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
      carat: 3,
      skinTone: "medium",
      metal: "white-gold",
      bandWidth: 2.5,
    },
  },
  {
    name: "rose-oval-ns",
    config: {
      ...DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
      shape: "oval",
      carat: 2.75,
      metal: "rose-gold",
      orientation: "ns",
    },
  },
  {
    name: "rose-oval-ew",
    config: {
      ...DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
      shape: "oval",
      carat: 2.75,
      metal: "rose-gold",
      orientation: "ew",
    },
  },
  {
    name: "emerald-4ct-dark-white-5mm",
    config: {
      ...DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
      shape: "emerald",
      carat: 4,
      skinTone: "dark",
      metal: "white-gold",
      bandWidth: 5,
    },
  },
];

function probeDiamondPixels(fullPng: PNG.PNG, fingerPng: PNG.PNG) {
  const { width, height, data } = fullPng;
  assert.equal(fingerPng.width, width);
  assert.equal(fingerPng.height, height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const dr = Math.abs(data[i]! - fingerPng.data[i]!);
      const dg = Math.abs(data[i + 1]! - fingerPng.data[i + 1]!);
      const db = Math.abs(data[i + 2]! - fingerPng.data[i + 2]!);
      const da = Math.abs(data[i + 3]! - fingerPng.data[i + 3]!);
      if (dr + dg + db + da < 24) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      count += 1;
    }
  }
  assert.ok(count > 200, `expected diamond pixels, found ${count}`);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    count,
  };
}

describe("Studio snapshot generation", () => {
  it("emits JPEG snapshots with canonical dimensions", async () => {
    const clean = await composeCleanStudioSnapshot(
      DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
    );
    assert.equal(clean.mimeType, "image/jpeg");
    assert.equal(clean.width, 1156);
    assert.equal(clean.height, 1486);
    assert.ok(clean.buffer.length > 8_000);
    assert.equal(clean.buffer[0], 0xff);
    assert.equal(clean.buffer[1], 0xd8);

    const card = await composeBrandedShareCard(
      DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
    );
    assert.equal(card.mimeType, "image/jpeg");
    assert.equal(card.width, CARD_WIDTH);
    assert.equal(card.height, CARD_HEIGHT);
    assert.ok(card.buffer.length > 8_000);
  });

  it("keeps clean snapshots internal while the branded card carries configuration copy", () => {
    const composeSrc = readFileSync(
      path.join(process.cwd(), "lib/diamond-studio/snapshot/compose.ts"),
      "utf8",
    );
    assert.match(composeSrc, /export async function composeCleanStudioSnapshot/);
    assert.match(composeSrc, /formatStudioCardCopy/);
    assert.match(composeSrc, /HOURGLASS DIAMONDS/);
    const cardFn = composeSrc.slice(
      composeSrc.indexOf("function drawBrandedCard"),
      composeSrc.indexOf("export async function composeStudioSnapshot"),
    );
    assert.doesNotMatch(cardFn, /skinTone/);
  });

  it("places the diamond using live face-dimension math (no eyeball)", async () => {
    const config = DIAMOND_STUDIO_CONFIGURATION_DEFAULTS;
    const [full, finger] = await Promise.all([
      composeCleanStudioSnapshotPng(config),
      composeFingerOnlyPng(config),
    ]);
    const fullPng = PNG.sync.read(full.buffer);
    const fingerPng = PNG.sync.read(finger.buffer);
    const measured = probeDiamondPixels(fullPng, fingerPng);
    const expected = expectedVisibleDiamondBox(config);

    const widthErr = Math.abs(measured.width - expected.width) / expected.width;
    const heightErr =
      Math.abs(measured.height - expected.height) / expected.height;
    const centerXErr = Math.abs(measured.centerX - expected.centerX);
    const centerYErr = Math.abs(measured.centerY - expected.centerY);

    assert.ok(
      widthErr < 0.06,
      `width err ${widthErr.toFixed(4)} measured=${measured.width} expected=${expected.width.toFixed(1)}`,
    );
    assert.ok(
      heightErr < 0.06,
      `height err ${heightErr.toFixed(4)} measured=${measured.height} expected=${expected.height.toFixed(1)}`,
    );
    assert.ok(
      centerXErr < 18,
      `centerX err ${centerXErr.toFixed(1)}px measured=${measured.centerX.toFixed(1)} expected=${expected.centerX.toFixed(1)}`,
    );
    assert.ok(
      centerYErr < 24,
      `centerY err ${centerYErr.toFixed(1)}px measured=${measured.centerY.toFixed(1)} expected=${expected.centerY.toFixed(1)}`,
    );
  });

  it("preserves EW oval orientation versus NS", async () => {
    const ns = {
      ...DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
      shape: "oval" as const,
      carat: 2.75,
      metal: "rose-gold" as const,
      orientation: "ns" as const,
    };
    const ew = { ...ns, orientation: "ew" as const };
    const [nsFull, nsFinger, ewFull, ewFinger] = await Promise.all([
      composeCleanStudioSnapshotPng(ns),
      composeFingerOnlyPng(ns),
      composeCleanStudioSnapshotPng(ew),
      composeFingerOnlyPng(ew),
    ]);
    const nsBox = probeDiamondPixels(
      PNG.sync.read(nsFull.buffer),
      PNG.sync.read(nsFinger.buffer),
    );
    const ewBox = probeDiamondPixels(
      PNG.sync.read(ewFull.buffer),
      PNG.sync.read(ewFinger.buffer),
    );
    assert.ok(nsBox.height > nsBox.width, "NS oval should be taller than wide");
    assert.ok(ewBox.width > ewBox.height, "EW oval should be wider than tall");
  });

  it("writes representative QA artifacts", async () => {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    for (const { name, config } of QA_CONFIGS) {
      const [clean, card] = await Promise.all([
        composeCleanStudioSnapshot(config),
        composeBrandedShareCard(config),
      ]);
      writeFileSync(path.join(ARTIFACT_DIR, `${name}-clean.jpg`), clean.buffer);
      writeFileSync(path.join(ARTIFACT_DIR, `${name}-card.jpg`), card.buffer);
      const copy = formatStudioCardCopy(config);
      assert.match(copy.headline, /ct /);
      assert.match(copy.detail, /Size /);
      assert.match(copy.detail, /mm /);
      assert.match(copy.detail, /Gold/);
      assert.doesNotMatch(`${copy.headline} ${copy.detail} ${copy.orientationLine ?? ""}`, /skin/i);
    }
  });
});
