import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { getRoundDiamondMm } from "@/lib/diamond-tech-suite/face-dimensions";
import { DIAMOND_STUDIO_CONFIGURATION_DEFAULTS } from "./configuration";
import {
  CLEAN_SNAPSHOT_HEIGHT,
  CLEAN_SNAPSHOT_WIDTH,
  MOBILE_STONE_RENDER_SCALE,
  SHAPE_RENDER_VISUAL_COMP,
  STAGE_CSS_LOCK,
  STONE_VIEWER_WIDTH_FACTOR,
  computeCanonicalSnapshotLayout,
  diamondLayerCqw,
  expectedVisibleDiamondBox,
  renderStoneWidthMm,
} from "./stage-calibration";

const page = readFileSync(
  path.join(process.cwd(), "app/diamond-studio/page.tsx"),
  "utf8",
);

describe("stage calibration lock", () => {
  it("keeps live CSS literals aligned with snapshot constants", () => {
    assert.match(page, new RegExp(`aspect-ratio:${STAGE_CSS_LOCK.aspectRatio}`));
    assert.match(
      page,
      new RegExp(`--dts-framing-lift:${STAGE_CSS_LOCK.framingLift}`),
    );
    assert.match(
      page,
      new RegExp(`--dts-composition-y:${STAGE_CSS_LOCK.compositionY}`),
    );
    assert.match(
      page,
      new RegExp(`--dts-diamond-y-nudge:${STAGE_CSS_LOCK.diamondYNudge}`),
    );
    assert.match(
      page,
      new RegExp(`--dts-ring-cluster-top:${STAGE_CSS_LOCK.ringClusterTop}`),
    );
    assert.match(
      page,
      new RegExp(
        `--dts-ring-cluster-top-tall:${STAGE_CSS_LOCK.ringClusterTopTall}`,
      ),
    );
    assert.match(page, /object-position:50% 42%/);
    assert.match(page, /width:min\(578px,/);
  });

  it("does not duplicate sizing constants in page.tsx", () => {
    assert.doesNotMatch(page, /const STONE_VIEWER_WIDTH_FACTOR/);
    assert.doesNotMatch(page, /const SHAPE_RENDER_VISUAL_COMP/);
    assert.match(page, /from "@\/lib\/diamond-studio\/stage-calibration"/);
  });

  it("derives layer cqw from face-dimension mm, not a second table", () => {
    const config = DIAMOND_STUDIO_CONFIGURATION_DEFAULTS;
    const mm = renderStoneWidthMm(config.shape, config.carat, config.orientation);
    assert.equal(mm, getRoundDiamondMm(2.5));
    const layer = diamondLayerCqw({
      shape: config.shape,
      carat: config.carat,
      orientation: config.orientation,
      ringSize: config.ringSize,
      isMobileViewport: false,
    });
    const expected =
      (STONE_VIEWER_WIDTH_FACTOR *
        SHAPE_RENDER_VISUAL_COMP.round *
        mm *
        100) /
      16.51;
    assert.ok(Math.abs(layer.widthCqw - expected) < 1e-9);
    assert.equal(layer.widthCqw, layer.heightCqw);
  });

  it("excludes mobile scale from canonical snapshots", () => {
    const mobile = diamondLayerCqw({
      shape: "round",
      carat: 2.5,
      orientation: "ns",
      ringSize: 6,
      isMobileViewport: true,
    });
    const desktop = diamondLayerCqw({
      shape: "round",
      carat: 2.5,
      orientation: "ns",
      ringSize: 6,
      isMobileViewport: false,
    });
    assert.ok(
      Math.abs(mobile.widthCqw / desktop.widthCqw - MOBILE_STONE_RENDER_SCALE) <
        1e-9,
    );
    const layout = computeCanonicalSnapshotLayout(
      DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
    );
    assert.equal(layout.viewerWidth, CLEAN_SNAPSHOT_WIDTH);
    assert.equal(layout.viewerHeight, CLEAN_SNAPSHOT_HEIGHT);
    const expectedW = (desktop.widthCqw / 100) * layout.viewerWidth;
    assert.ok(Math.abs(layout.layerWidthPx - expectedW) < 1e-6);
  });

  it("keeps EW oval width/height swapped versus NS", () => {
    const ns = expectedVisibleDiamondBox({
      ...DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
      shape: "oval",
      carat: 2.75,
      metal: "rose-gold",
      orientation: "ns",
    });
    const ew = expectedVisibleDiamondBox({
      ...DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
      shape: "oval",
      carat: 2.75,
      metal: "rose-gold",
      orientation: "ew",
    });
    assert.ok(ns.height > ns.width);
    assert.ok(ew.width > ew.height);
  });
});
