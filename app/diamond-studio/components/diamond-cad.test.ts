import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { PNG } from "pngjs";
import {
  DIAMOND_CAD_ASSETS,
  DIAMOND_CAD_SHAPE_IDS,
  getDiamondCadAsset,
  nextCadFallbackSrc,
} from "./diamond-cad-assets";
import {
  CAD_ADJUST_HOLD_MS,
  CAD_SCINTILLATION_CROSSFADE_MS,
  CAD_SCINTILLATION_FADE_OUT_MS,
  CAD_SCINTILLATION_MIN_INTERVAL_MS,
} from "./diamond-cad-light";
import {
  computeScintillationAdvance,
  hideScintillationSlots,
  nextScintillationSlots,
  resetScintillationState,
} from "./diamond-cad-scintillation-state";
import { ALL_SHAPE_IDS, type ShapeId } from "./diamond-cad-types";

const ROOT = path.resolve(process.cwd());
const DIAMONDS_V2_DIR = path.join(ROOT, "public/diamond-tech-suite/diamonds-v2");
const LEGACY_DIAMONDS_PREFIX = "/diamond-tech-suite/diamonds/";
const V2_PREFIX = "/diamond-tech-suite/diamonds-v2/";
const V2_CANONICAL = /^\/diamond-tech-suite\/diamonds-v2\/diamond-[a-z]+-v2\.png$/;
const ALPHA = 10;

const VENDOR_PREFIX = "HRG-OTH-R-";

function publicToFs(url: string): string {
  assert.ok(url.startsWith("/"), `expected public URL: ${url}`);
  return path.join(ROOT, "public", url.slice(1));
}

function loadPng(filePath: string) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function probeBounds(png: PNG.PNG) {
  const { width, height, data } = png;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a <= ALPHA) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      sumX += x;
      sumY += y;
      count++;
    }
  }
  assert.ok(count > 0, "no visible pixels");
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    cx: sumX / count,
    cy: sumY / count,
    count,
  };
}

function collectAssetUrls(asset: (typeof DIAMOND_CAD_ASSETS)[ShapeId]): string[] {
  return [asset.src, asset.originalSrc, asset.switcherSrc, asset.fallbackSrc, ...asset.variants];
}

describe("Diamond Studio V2 asset config", () => {
  it("covers every ShapeId exactly once", () => {
    assert.deepEqual([...DIAMOND_CAD_SHAPE_IDS].sort(), [...ALL_SHAPE_IDS].sort());
    for (const id of ALL_SHAPE_IDS) {
      const asset = getDiamondCadAsset(id);
      assert.equal(asset.shapeId, id);
    }
  });

  it("every shape uses only diamonds-v2 canonical PNG paths", () => {
    for (const id of ALL_SHAPE_IDS) {
      const a = DIAMOND_CAD_ASSETS[id];
      const expected = `${V2_PREFIX}diamond-${id}-v2.png`;
      assert.equal(a.src, expected);
      assert.equal(a.originalSrc, expected);
      assert.equal(a.switcherSrc, expected);
      assert.equal(a.fallbackSrc, expected);
      assert.match(a.src, V2_CANONICAL);
    }
  });

  it("does not reference legacy diamonds/, cad-pop, rbc-cad, or scintillation paths", () => {
    for (const id of ALL_SHAPE_IDS) {
      const urls = collectAssetUrls(DIAMOND_CAD_ASSETS[id]);
      for (const url of urls) {
        assert.ok(!url.startsWith(LEGACY_DIAMONDS_PREFIX), url);
        assert.ok(!url.includes("cad-pop"), url);
        assert.ok(!url.includes("rbc-cad"), url);
        assert.ok(!url.includes("cad-scintillation"), url);
        assert.ok(!url.includes("-cad-switcher"), url);
      }
    }
  });

  it("disables scintillation for every shape", () => {
    for (const id of ALL_SHAPE_IDS) {
      const a = DIAMOND_CAD_ASSETS[id];
      assert.equal(a.scintillationEnabled, false);
      assert.equal(a.variants.length, 0);
    }
  });

  it("does not use vendor source filenames as runtime URLs", () => {
    for (const id of ALL_SHAPE_IDS) {
      for (const url of collectAssetUrls(DIAMOND_CAD_ASSETS[id])) {
        assert.ok(!url.includes(VENDOR_PREFIX), url);
        assert.ok(!url.includes(" 3 carat"), url);
        assert.ok(!/%20/.test(url), url);
      }
    }
  });

  it("maps unique asset paths per shape with no cross-shape collisions", () => {
    const seen = new Map<string, ShapeId>();
    for (const id of ALL_SHAPE_IDS) {
      for (const url of collectAssetUrls(DIAMOND_CAD_ASSETS[id])) {
        const prev = seen.get(url);
        assert.ok(!prev || prev === id, `duplicate mapping ${url}: ${prev} vs ${id}`);
        seen.set(url, id);
      }
    }
  });

  it("every referenced V2 file exists and is non-zero bytes", () => {
    for (const id of ALL_SHAPE_IDS) {
      const a = DIAMOND_CAD_ASSETS[id];
      for (const url of collectAssetUrls(a)) {
        const fsPath = publicToFs(url);
        assert.ok(fs.existsSync(fsPath), url);
        const stat = fs.statSync(fsPath);
        assert.ok(stat.size > 0, url);
        assert.ok(fsPath.startsWith(DIAMONDS_V2_DIR), fsPath);
      }
    }
  });

  it("fallback chain stays on the V2 src", () => {
    const asset = getDiamondCadAsset("oval");
    const ultimate = "/diamond-tech-suite/diamonds-v2/diamond-round-v2.png";
    assert.equal(nextCadFallbackSrc(asset.src, asset, ultimate), asset.src);
    assert.equal(nextCadFallbackSrc(asset.originalSrc, asset, ultimate), asset.originalSrc);
  });
});

describe("Diamond Studio V2 PNG bounds", () => {
  for (const id of ALL_SHAPE_IDS) {
    it(`${id}: probed bounds match configured visibleBounds`, () => {
      const asset = DIAMOND_CAD_ASSETS[id];
      const png = loadPng(publicToFs(asset.src));
      const bounds = probeBounds(png);
      assert.equal(png.width, asset.canvas.width);
      assert.equal(png.height, asset.canvas.height);
      assert.ok(Math.abs(bounds.minX - asset.visibleBounds.minX) <= 1);
      assert.ok(Math.abs(bounds.minY - asset.visibleBounds.minY) <= 1);
      assert.ok(Math.abs(bounds.maxX - asset.visibleBounds.maxX) <= 1);
      assert.ok(Math.abs(bounds.maxY - asset.visibleBounds.maxY) <= 1);
    });
  }
});

describe("Diamond CAD scintillation state", () => {
  it("cycles a → b → c → d → a", () => {
    let patternIndex = -1;
    let lastAdvanceAt = 0;
    const times = [1000, 2000, 3000, 4000, 5000];
    const indices: number[] = [];
    for (let i = 0; i < times.length; i++) {
      const result = computeScintillationAdvance({
        active: true,
        carat: 2.5 + i * 0.25,
        lastCarat: 2.5 + (i - 1) * 0.25,
        patternIndex,
        lastAdvanceAt,
        now: times[i]!,
        variantCount: 4,
      });
      assert.equal(result.accepted, true);
      patternIndex = result.patternIndex;
      lastAdvanceAt = result.lastAdvanceAt;
      indices.push(result.nextIndex);
    }
    assert.deepEqual(indices, [0, 1, 2, 3, 0]);
  });

  it("ignores advances inside the minimum interval", () => {
    const first = computeScintillationAdvance({
      active: true,
      carat: 2.75,
      lastCarat: 2.5,
      patternIndex: -1,
      lastAdvanceAt: 0,
      now: 1000,
      variantCount: 4,
    });
    assert.equal(first.accepted, true);
    const second = computeScintillationAdvance({
      active: true,
      carat: 3.0,
      lastCarat: 2.75,
      patternIndex: first.patternIndex,
      lastAdvanceAt: first.lastAdvanceAt,
      now: first.lastAdvanceAt + 100,
      variantCount: 4,
    });
    assert.equal(second.accepted, false);
  });

  it("reset clears pattern; inactive returns to base", () => {
    const reset = resetScintillationState();
    assert.equal(reset.patternIndex, -1);
    assert.equal(reset.slotA.visible, false);
    assert.equal(reset.slotB.visible, false);
    const hidden = hideScintillationSlots(
      { variant: 2, visible: true },
      { variant: 1, visible: true },
    );
    assert.equal(hidden.slotA.visible, false);
    assert.equal(hidden.slotB.visible, false);
  });

  it("reduced-motion still shows a single visible slot without crossfade churn", () => {
    const next = nextScintillationSlots({
      reducedMotion: true,
      nextIndex: 2,
      front: "b",
      slotA: { variant: 0, visible: false },
      slotB: { variant: 1, visible: true },
    });
    assert.equal(next.front, "a");
    assert.equal(next.slotA.visible, true);
    assert.equal(next.slotB.visible, false);
    assert.equal(next.patternIndex, 2);
  });

  it("does not advance when inactive", () => {
    const result = computeScintillationAdvance({
      active: false,
      carat: 3,
      lastCarat: 2.5,
      patternIndex: 1,
      lastAdvanceAt: 0,
      now: 5000,
      variantCount: 4,
    });
    assert.equal(result.accepted, false);
  });
});

describe("Diamond CAD render configuration", () => {
  it("uses shared timing constants from the Round baseline", () => {
    assert.equal(CAD_SCINTILLATION_MIN_INTERVAL_MS, 360);
    assert.equal(CAD_SCINTILLATION_CROSSFADE_MS, 190);
    assert.equal(CAD_ADJUST_HOLD_MS, 460);
    assert.equal(CAD_SCINTILLATION_FADE_OUT_MS, 340);
  });

  it("assigns brilliant vs step profiles correctly", () => {
    const step: ShapeId[] = ["emerald", "asscher"];
    for (const id of ALL_SHAPE_IDS) {
      const expected = step.includes(id) ? "step" : "brilliant";
      assert.equal(DIAMOND_CAD_ASSETS[id].profile, expected);
    }
  });

  it("round visible scale matches the reference compensation", () => {
    const round = getDiamondCadAsset("round");
    assert.ok(Math.abs(round.visibleScale - (1420 / 1500) / (1679 / 2560)) < 1e-9);
  });
});

describe("Diamond Studio runtime must not reference legacy diamond paths", () => {
  it("active diamond-studio source files exclude legacy diamonds/ stage paths", () => {
    const studioRoot = path.join(ROOT, "app/diamond-studio");
    const files = fs
      .readdirSync(studioRoot, { recursive: true })
      .filter(
        (f): f is string =>
          typeof f === "string" &&
          (f.endsWith(".ts") || f.endsWith(".tsx")) &&
          !f.endsWith(".test.ts"),
      );
    const banned = [
      /\/diamond-tech-suite\/diamonds\/(?!v2)/,
      /-cad-pop\.png/,
      /\/diamond-tech-suite\/diamonds\/rbc-cad/,
      /-cad-scintillation-[a-d]\.png/,
    ];
    for (const rel of files) {
      const content = fs.readFileSync(path.join(studioRoot, rel), "utf8");
      for (const pattern of banned) {
        assert.ok(!pattern.test(content), `${rel} matches ${pattern}`);
      }
    }
  });
});
