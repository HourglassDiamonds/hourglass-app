import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { PNG } from "pngjs";
import {
  DELIVERED_CAD_SHAPE_IDS,
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
const DIAMONDS_DIR = path.join(ROOT, "public/diamond-tech-suite/diamonds");
const ALPHA = 10;
const OPAQUE = 12;

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

describe("Diamond CAD config completeness", () => {
  it("covers every ShapeId exactly once", () => {
    assert.deepEqual([...DIAMOND_CAD_SHAPE_IDS].sort(), [...ALL_SHAPE_IDS].sort());
    for (const id of ALL_SHAPE_IDS) {
      const asset = getDiamondCadAsset(id);
      assert.equal(asset.shapeId, id);
    }
  });

  it("provides base, original, switcher, variants, and legacy fallback", () => {
    for (const id of ALL_SHAPE_IDS) {
      const a = DIAMOND_CAD_ASSETS[id];
      if (a.scintillationEnabled) {
        assert.ok(a.src.endsWith("-pop.png") || a.src.includes("rbc-cad-pop"));
        assert.ok(a.originalSrc.endsWith("-cad.png") || a.originalSrc.includes("rbc-cad.png"));
        assert.equal(a.variants.length, 4);
      } else {
        assert.match(a.src, new RegExp(`diamond-${id}-cad-3ct\\.png$`));
        assert.match(a.switcherSrc, new RegExp(`diamond-${id}-cad-3ct-switcher\\.png$`));
        assert.equal(a.variants.length, 0);
        assert.equal(a.scintillationEnabled, false);
      }
      assert.ok(a.switcherSrc.includes("-switcher.png"));
      assert.ok(a.fallbackSrc.endsWith(`/${id === "round" ? "round" : id}.png`) || a.fallbackSrc.includes(`/${id}.png`));
      assert.ok(fs.existsSync(publicToFs(a.src)), a.src);
      assert.ok(fs.existsSync(publicToFs(a.originalSrc)), a.originalSrc);
      assert.ok(fs.existsSync(publicToFs(a.switcherSrc)), a.switcherSrc);
      assert.ok(fs.existsSync(publicToFs(a.fallbackSrc)), a.fallbackSrc);
      for (const v of a.variants) {
        assert.ok(fs.existsSync(publicToFs(v)), v);
      }
    }
  });

  it("does not use vendor source filenames as runtime URLs", () => {
    for (const id of ALL_SHAPE_IDS) {
      const a = DIAMOND_CAD_ASSETS[id];
      const urls = [a.src, a.originalSrc, a.switcherSrc, a.fallbackSrc, ...a.variants];
      for (const url of urls) {
        assert.ok(!url.includes(VENDOR_PREFIX), url);
        assert.ok(!url.includes(" 3 carat"), url);
        assert.ok(!/%20/.test(url), url);
      }
    }
  });

  it("maps unique asset paths per shape with no cross-shape collisions", () => {
    const seen = new Map<string, ShapeId>();
    for (const id of ALL_SHAPE_IDS) {
      const a = DIAMOND_CAD_ASSETS[id];
      for (const url of [a.src, a.originalSrc, a.switcherSrc, ...a.variants]) {
        const prev = seen.get(url);
        assert.ok(!prev || prev === id, `duplicate mapping ${url}: ${prev} vs ${id}`);
        seen.set(url, id);
      }
    }
  });
});

describe("Delivered PNG fancy shapes (runtime render source)", () => {
  for (const id of DELIVERED_CAD_SHAPE_IDS) {
    it(`${id}: main stage src is diamond-${id}-cad-3ct.png`, () => {
      const a = getDiamondCadAsset(id);
      assert.equal(a.src, `/diamond-tech-suite/diamonds/diamond-${id}-cad-3ct.png`);
      assert.equal(a.scintillationEnabled, false);
      assert.equal(a.variants.length, 0);
      assert.ok(!a.src.includes("cad-pop"), a.src);
    });
  }

  it("only round may use rbc-cad-pop or scintillation variants", () => {
    for (const id of ALL_SHAPE_IDS) {
      const a = DIAMOND_CAD_ASSETS[id];
      if (id === "round") {
        assert.match(a.src, /rbc-cad-pop\.png$/);
        assert.equal(a.scintillationEnabled, true);
        continue;
      }
      assert.equal(a.scintillationEnabled, false, id);
      assert.ok(!a.src.includes("cad-pop"), a.src);
      assert.equal(a.variants.length, 0, id);
    }
  });
});

describe("Diamond CAD PNG / asset validation", () => {
  for (const id of ALL_SHAPE_IDS) {
    it(`${id}: base and variants share dimensions, bounds, alpha silhouette`, () => {
      const asset = DIAMOND_CAD_ASSETS[id];
      const base = loadPng(publicToFs(asset.src));
      const baseBounds = probeBounds(base);
      assert.equal(base.width, asset.canvas.width);
      assert.equal(base.height, asset.canvas.height);
      assert.ok(Math.abs(baseBounds.minX - asset.visibleBounds.minX) <= 1);
      assert.ok(Math.abs(baseBounds.minY - asset.visibleBounds.minY) <= 1);
      assert.ok(Math.abs(baseBounds.maxX - asset.visibleBounds.maxX) <= 1);
      assert.ok(Math.abs(baseBounds.maxY - asset.visibleBounds.maxY) <= 1);

      if (!asset.scintillationEnabled) {
        const switcher = loadPng(publicToFs(asset.switcherSrc));
        const swBounds = probeBounds(switcher);
        assert.ok(swBounds.width > 10 && swBounds.height > 10);
        assert.ok(switcher.width === 512 && switcher.height === 512);
        return;
      }

      for (const variantUrl of asset.variants) {
        const variant = loadPng(publicToFs(variantUrl));
        assert.equal(variant.width, base.width);
        assert.equal(variant.height, base.height);

        const vBounds = probeBounds(variant);
        assert.ok(Math.abs(vBounds.minX - baseBounds.minX) <= 1);
        assert.ok(Math.abs(vBounds.minY - baseBounds.minY) <= 1);
        assert.ok(Math.abs(vBounds.maxX - baseBounds.maxX) <= 1);
        assert.ok(Math.abs(vBounds.maxY - baseBounds.maxY) <= 1);
        assert.ok(Math.abs(vBounds.cx - baseBounds.cx) <= 1);
        assert.ok(Math.abs(vBounds.cy - baseBounds.cy) <= 1);

        let outsideSilhouette = 0;
        let alphaMismatch = 0;
        let changed = 0;
        let opaque = 0;
        const n = base.width * base.height;
        for (let i = 0; i < n; i++) {
          const o = i * 4;
          const ba = base.data[o + 3]!;
          const va = variant.data[o + 3]!;
          if (ba !== va) alphaMismatch++;
          if (ba < OPAQUE) {
            if (va >= OPAQUE) outsideSilhouette++;
            continue;
          }
          opaque++;
          const dr = Math.abs(variant.data[o]! - base.data[o]!);
          const dg = Math.abs(variant.data[o + 1]! - base.data[o + 1]!);
          const db = Math.abs(variant.data[o + 2]! - base.data[o + 2]!);
          if ((dr + dg + db) / 3 >= 1) changed++;
        }
        assert.equal(alphaMismatch, 0, `${id} ${variantUrl} alpha drifted`);
        assert.equal(outsideSilhouette, 0, `${id} pixels outside silhouette`);
        assert.ok(changed > 0, `${id} variant identical to base`);
        const changedFrac = changed / opaque;
        assert.ok(
          changedFrac >= 0.005 && changedFrac <= 0.25,
          `${id} changedFrac=${changedFrac}`,
        );
      }

      const switcher = loadPng(publicToFs(asset.switcherSrc));
      const swBounds = probeBounds(switcher);
      assert.ok(swBounds.width > 10 && swBounds.height > 10);
      assert.ok(switcher.width === 512 && switcher.height === 512);
    });
  }

  it("studio manifest exists and matches shape set", () => {
    const manifestPath = path.join(DIAMONDS_DIR, "diamond-cad-manifest.json");
    assert.ok(fs.existsSync(manifestPath));
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      shapes: Record<string, { assets: { src: string } }>;
    };
    for (const id of ALL_SHAPE_IDS) {
      assert.ok(manifest.shapes[id], id);
      assert.equal(manifest.shapes[id]!.assets.src, DIAMOND_CAD_ASSETS[id].src);
    }
  });
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

  it("delivered fancy shapes skip pop/original in fallback chain", () => {
    const asset = getDiamondCadAsset("oval");
    const ultimate = "/diamond-tech-suite/diamonds/round.png";
    assert.equal(nextCadFallbackSrc(asset.src, asset, ultimate), asset.fallbackSrc);
    assert.equal(
      nextCadFallbackSrc(asset.fallbackSrc, asset, ultimate),
      ultimate,
    );

    const round = getDiamondCadAsset("round");
    assert.equal(nextCadFallbackSrc(round.src, round, ultimate), round.originalSrc);
  });

  it("round visible scale matches the reference CAD compensation", () => {
    const round = getDiamondCadAsset("round");
    assert.ok(Math.abs(round.visibleScale - (1420 / 1500) / (1679 / 2560)) < 1e-9);
  });

  it("every shape uses correct stage/switcher asset naming", () => {
    for (const id of ALL_SHAPE_IDS) {
      const a = DIAMOND_CAD_ASSETS[id];
      if (a.scintillationEnabled) {
        assert.match(a.src, /cad-pop\.png$/);
        assert.match(a.switcherSrc, /cad-switcher\.png$/);
      } else {
        assert.match(a.src, /diamond-.*-cad-3ct\.png$/);
        assert.match(a.switcherSrc, /diamond-.*-cad-3ct-switcher\.png$/);
      }
    }
  });
});
