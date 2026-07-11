import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("mobile mark-card actions live in the Photo card", () => {
  const panel = read(
    "app/diamond-shape-studio/components/hand-photo-panel.tsx",
  );
  const stage = read(
    "app/diamond-shape-studio/components/overlay-stage.tsx",
  );
  const view = read("app/diamond-shape-studio/shape-studio-view.tsx");
  const styles = read(
    "app/diamond-shape-studio/components/shape-studio-styles.tsx",
  );

  it("Photo card hosts Set photo scale, Reset points, then Start over in order", () => {
    const actions = panel.slice(panel.indexOf("data-dss-photo-card-actions"));
    const setIdx = actions.indexOf('data-dss-photo-action="set-photo-scale"');
    const resetIdx = actions.indexOf('data-dss-photo-action="reset-points"');
    const startIdx = actions.indexOf('data-dss-photo-action="start-over"');
    assert.ok(setIdx >= 0);
    assert.ok(resetIdx > setIdx);
    assert.ok(startIdx > resetIdx);
    assert.match(actions, /Set photo scale/);
    assert.match(actions, /Reset points/);
    assert.match(actions, /Start over/);
  });

  it("narrow mark-card suppresses the stage guide row copy of those controls", () => {
    assert.match(stage, /suppressMarkCardActions/);
    assert.match(stage, /showMarkCardStageActions/);
    assert.match(stage, /!suppressMarkCardActions/);
    assert.match(view, /suppressMarkCardActions=\{markCardInPhotoCard\}/);
    assert.match(view, /markCardActions=\{/);
    assert.match(view, /onSetPhotoScale: handleGuidedContinue/);
    assert.match(view, /onResetPoints: handleGuidedReset/);
  });

  it("mobile layout breakpoint drives Photo-card hosting without duplicating desktop stage actions", () => {
    assert.match(view, /DIRECT_MOBILE_ENTRY_MAX_WIDTH_PX/);
    assert.match(view, /useNarrowShapeStudioLayout/);
    assert.match(view, /markCardInPhotoCard/);
    assert.match(view, /data-mark-card-actions=\{markCardInPhotoCard \? "photo-card" : "stage"\}/);
    // Desktop still has stage mark-card actions when not suppressed
    assert.match(stage, /data-dss-stage-action="set-photo-scale"/);
    assert.match(stage, /data-dss-stage-action="reset-points"/);
  });

  it("cardEdgeOk is shared from OverlayStage into the Photo card CTA", () => {
    assert.match(stage, /onCardEdgeOkChange/);
    assert.match(view, /onCardEdgeOkChange=\{setCardEdgeOk\}/);
    assert.match(panel, /disabled=\{!markCardActions\.cardEdgeOk\}/);
  });

  it("Start over remains the quiet full-width restart control under the calibration pair", () => {
    assert.match(panel, /dss-photo-card-start-over/);
    assert.match(styles, /\.dss-photo-card-start-over\{[\s\S]*?width:100%/);
    assert.match(
      styles,
      /@media \(max-width: 960px\)[\s\S]*\.dss-photo-card-start-over\{[\s\S]*?min-height:44px/,
    );
  });

  it("does not leave an order-0 stage guide row above the H1 on mobile", () => {
    const mobile = styles.slice(styles.indexOf("@media (max-width: 960px)"));
    assert.match(mobile, /\.dss-guide-actions\{[\s\S]*?order:4/);
    assert.match(mobile, /\.dss-tool-header\{[\s\S]*?order:1/);
  });
});
