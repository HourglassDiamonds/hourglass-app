import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  CARAT_MAX,
  CARAT_MIN,
  CARAT_STEP,
  caratFromSliderPct,
  caratSliderPct,
  snapCarat,
} from "@/lib/shape-studio/constants";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("mobile affordance polish — slider and guide lines", () => {
  const styles = read(
    "app/diamond-shape-studio/components/shape-studio-styles.tsx",
  );
  const track = read(
    "app/diamond-shape-studio/components/horizontal-track.ts",
  );
  const controls = read(
    "app/diamond-shape-studio/components/calibration-controls.tsx",
  );
  const markers = read(
    "app/diamond-shape-studio/components/calibration-markers.tsx",
  );

  const desktopBlock = styles.slice(
    0,
    styles.indexOf("@media (max-width: 960px)"),
  );
  const mobileBlock = styles.slice(styles.indexOf("@media (max-width: 960px)"));

  it("mobile slider exposes an effective ~48–52px touch target", () => {
    assert.match(mobileBlock, /\.dss-track\{[\s\S]*?height:52px/);
    assert.match(mobileBlock, /\.dss-track\{[\s\S]*?min-height:52px/);
    assert.match(mobileBlock, /\.dss-handle\{[\s\S]*?width:52px;\s*height:52px/);
    assert.match(styles, /\.dss-track\{[\s\S]*?touch-action:none/);
    assert.match(mobileBlock, /\.dss-shell\[data-slider-adjusting\]/);
  });

  it("desktop slider geometry remains the quieter 36px / 10px treatment", () => {
    assert.match(desktopBlock, /\.dss-track\{[\s\S]*?height:36px/);
    assert.match(desktopBlock, /\.dss-handle\{[\s\S]*?width:10px;\s*height:10px/);
    assert.doesNotMatch(desktopBlock, /\.dss-track\{[\s\S]*?height:52px/);
    assert.doesNotMatch(desktopBlock, /\.dss-handle\{[\s\S]*?width:52px/);
  });

  it("visual mobile thumb stays restrained (~20px via ::after), larger only while dragging", () => {
    assert.match(
      mobileBlock,
      /\.dss-handle::after\{[\s\S]*?width:20px;\s*height:20px/,
    );
    assert.match(
      mobileBlock,
      /\.dss-track\.is-dragging \.dss-handle::after\{[\s\S]*?width:22px/,
    );
  });

  it("uses pointer capture so drag continues outside the visible track", () => {
    assert.match(track, /setPointerCapture/);
    assert.match(track, /pointerdown/);
    assert.match(track, /pointermove/);
    assert.match(track, /pctFromClientX/);
  });

  it("slider min, max, step, and value mapping are unchanged", () => {
    assert.equal(CARAT_MIN, 1.0);
    assert.equal(CARAT_MAX, 10.0);
    assert.equal(CARAT_STEP, 0.25);
    assert.equal(caratSliderPct(1), 0);
    assert.equal(caratSliderPct(10), 100);
    assert.equal(caratFromSliderPct(0), 1);
    assert.equal(caratFromSliderPct(1), 10);
    assert.equal(snapCarat(2.1), 2.0);
    assert.equal(snapCarat(2.2), 2.25);
    assert.doesNotMatch(controls, /CARAT_MIN\s*=/);
    assert.doesNotMatch(track, /CARAT_/);
  });

  it("active dragging applies enhanced guide-line state; release clears slider UI", () => {
    assert.match(track, /classList\.toggle\("is-dragging"/);
    assert.match(track, /data-slider-adjusting/);
    assert.match(track, /removeAttribute\("data-slider-adjusting"\)/);
    assert.match(
      mobileBlock,
      /\.dss-cal-layer:has\(\.dss-cal-handle\.is-dragging\) \.dss-cal-segment/,
    );
    assert.match(
      mobileBlock,
      /\.dss-cal-endpoint:has\(\.dss-cal-handle\.is-dragging\) \.dss-cal-handle-ring/,
    );
  });

  it("keyboard interaction remains available on the carat track", () => {
    assert.match(controls, /role="slider"/);
    assert.match(controls, /tabIndex=\{0\}/);
    assert.match(controls, /ArrowLeft/);
    assert.match(controls, /ArrowRight/);
    assert.match(controls, /aria-valuemin=\{CARAT_MIN\}/);
    assert.match(controls, /aria-valuemax=\{CARAT_MAX\}/);
    assert.match(controls, /aria-valuenow=\{carat\}/);
  });

  it("guide lines remain present; connector insets to each handle ring’s inner edge", () => {
    assert.match(markers, /dss-cal-segment/);
    assert.match(markers, /dss-cal-handle/);
    assert.match(markers, /is-dragging/);
    assert.match(markers, /contentToStagePx/);
    assert.match(markers, /connectorSegmentGeometry/);
    assert.match(markers, /HANDLE_RING_DIAMETER_PX = 21/);
    assert.match(markers, /HANDLE_RING_DIAMETER_MOBILE_PX = 24/);
    assert.match(desktopBlock, /\.dss-cal-handle-ring\{[\s\S]*?width:21px;\s*height:21px/);
    assert.match(mobileBlock, /\.dss-cal-handle-ring\{[\s\S]*?width:24px;\s*height:24px/);
    assert.doesNotMatch(markers, /CARD_LONG_EDGE|85\.6|53\.98/);
    assert.doesNotMatch(styles, /pixelsPerMm|overlaySizeFromCardPpm/);
  });

  it("mobile guide lines use dual-edge contrast without neon treatment", () => {
    assert.match(mobileBlock, /\.dss-cal-segment\{[\s\S]*?box-shadow:/);
    assert.match(mobileBlock, /\.dss-cal-jaw\{[\s\S]*?box-shadow:/);
    assert.doesNotMatch(mobileBlock, /#00f|#0ff|neon|rgb\(0,\s*122,\s*255\)/i);
  });

  it("horizontal overflow guard remains on the mobile shell", () => {
    assert.match(mobileBlock, /\.dss-shell\{[\s\S]*?overflow-x:hidden/);
  });
});
