import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("mobile hand-photo journey control hierarchy", () => {
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
  const markers = read(
    "app/diamond-shape-studio/components/calibration-markers.tsx",
  );

  const mobile = styles.slice(styles.indexOf("@media (max-width: 960px)"));

  it("uses revised mobile labels without renaming internal step ids", () => {
    assert.match(stage, /Set card scale/);
    assert.match(stage, /Frame my finger/);
    assert.match(stage, /Adjust card scale/);
    assert.match(stage, /Reframe finger/);
    assert.match(stage, /Frame your finger/);
    assert.doesNotMatch(stage, /Set photo scale/);
    assert.doesNotMatch(stage, /Frame my hand/);
    assert.doesNotMatch(stage, /Adjust card marks/);
    assert.doesNotMatch(stage, />\s*Reframe\s*</);
    assert.match(stage, /guidedStep === "mark-card"/);
    assert.match(stage, /guidedStep === "mark-seat"/);
    assert.match(stage, /guidedStep === "frame"/);
  });

  it("keeps mark-card actions under the photo with Start Over tertiary on narrow", () => {
    const markCard = stage.slice(
      stage.indexOf('{showMarkCardStageActions ? ('),
      stage.indexOf("{showMarkSeatStageActions ? ("),
    );
    const setIdx = markCard.indexOf('data-dss-stage-action="set-card-scale"');
    const resetIdx = markCard.indexOf('data-dss-stage-action="reset-points"');
    const startIdx = markCard.indexOf('data-dss-stage-action="start-over"');
    assert.ok(setIdx >= 0);
    assert.ok(resetIdx > setIdx);
    assert.ok(startIdx > resetIdx);
    assert.match(markCard, /dss-guide-btn--tertiary/);
    assert.match(markCard, /narrowLayout && onStartOver/);
  });

  it("groups ring-position actions as Frame my finger → Adjust card scale → Start over", () => {
    const markSeat = stage.slice(
      stage.indexOf("{showMarkSeatStageActions ? ("),
      stage.indexOf("{showFrameStageActions ? ("),
    );
    const frameIdx = markSeat.indexOf('data-dss-stage-action="frame-my-finger"');
    const adjustIdx = markSeat.indexOf(
      'data-dss-stage-action="adjust-card-scale"',
    );
    const startIdx = markSeat.indexOf('data-dss-stage-action="start-over"');
    assert.ok(frameIdx >= 0);
    assert.ok(adjustIdx > frameIdx);
    assert.ok(startIdx > adjustIdx);
  });

  it("keeps finger-framing controls in one coherent stage group", () => {
    const frame = stage.slice(
      stage.indexOf("{showFrameStageActions ? ("),
      stage.indexOf("calibrated && !narrowLayout"),
    );
    assert.match(frame, /data-dss-stage-action="show-diamond-preview"/);
    assert.match(frame, /data-dss-stage-action="reset-framing"/);
    assert.match(frame, /data-dss-stage-action="adjust-ring-position"/);
    assert.match(frame, /data-dss-stage-action="start-over"/);
  });

  it("hides carat and shape on mobile until calibrated-preview", () => {
    assert.match(view, /showDiamondControls/);
    assert.match(view, /showShapeSelector/);
    assert.match(
      view,
      /calibrated \|\| \(!narrowLayout && awaitingCardCalibration\)/,
    );
    assert.match(view, /calibrated \|\| !narrowLayout/);
    assert.match(view, /data-diamond-controls=\{showDiamondControls \? "visible" : "hidden"\}/);
    assert.match(view, /\{showDiamondControls \? \(/);
    assert.match(view, /\{showShapeSelector \? \(/);
  });

  it("omits the Photo status card during mobile calibration and final preview", () => {
    assert.match(view, /showPhotoCard = showRail && !narrowLayout/);
    assert.match(view, /\{showPhotoCard \? \(/);
    assert.match(panel, /Hand-and-card photo ready/);
    assert.match(panel, /data-dss-photo-action="start-over"/);
    assert.doesNotMatch(panel, /markCardActions/);
    assert.doesNotMatch(panel, /Set card scale|Set photo scale/);
    assert.match(mobile, /\[data-dss-photo-card\]\{ display:none/);
  });

  it("puts Carat Weight before setup-repair on final preview mobile order", () => {
    assert.match(mobile, /\[data-dss-carat-card\]\{ order:6/);
    assert.match(mobile, /\.dss-shape-strip-wrap\{[\s\S]*?order:9/);
    assert.match(mobile, /\.dss-setup-repair\{[\s\S]*?order:10/);
    assert.match(stage, /data-dss-setup-repair/);
    assert.match(stage, /Adjust photo setup/);
    const setup = stage.slice(stage.indexOf("data-dss-setup-repair"));
    const reframeIdx = setup.indexOf('data-dss-stage-action="reframe-finger"');
    const ringIdx = setup.indexOf('data-dss-stage-action="adjust-ring-position"');
    const cardIdx = setup.indexOf('data-dss-stage-action="adjust-card-scale"');
    const startIdx = setup.indexOf('data-dss-stage-action="start-over"');
    assert.ok(reframeIdx >= 0);
    assert.ok(ringIdx > reframeIdx);
    assert.ok(cardIdx > ringIdx);
    assert.ok(startIdx > cardIdx);
  });

  it("removed unused suppressMarkCardActions API", () => {
    assert.doesNotMatch(stage, /suppressMarkCardActions/);
    assert.doesNotMatch(view, /suppressMarkCardActions/);
  });

  it("does not duplicate calibrated setup actions on narrow layout", () => {
    assert.match(stage, /calibrated && !narrowLayout/);
    assert.match(stage, /calibrated && narrowLayout/);
    assert.match(view, /narrowLayout=\{narrowLayout\}/);
    assert.match(view, /onStartOver=\{handleStartOver\}/);
  });

  it("does not leave an order-0 frame copy or guide row above the H1", () => {
    assert.match(mobile, /\.dss-guide-actions\{[\s\S]*?order:4/);
    assert.match(mobile, /\.dss-frame-copy\{[\s\S]*?order:4/);
    assert.match(mobile, /\.dss-tool-header\{[\s\S]*?order:1/);
  });

  it("renders outward grab circles with precision ticks at measured endpoints", () => {
    assert.match(markers, /GRIP_OFFSET_PX = 26/);
    assert.match(markers, /GRIP_OFFSET_MOBILE_PX = 34/);
    assert.match(markers, /TICK_CONNECTOR_INSET_PX/);
    assert.match(markers, /data-dss-cal-tick/);
    assert.match(markers, /data-dss-cal-grip/);
    assert.match(markers, /data-dss-cal-stem/);
    assert.match(markers, /data-dss-cal-connector/);
    // Ring lives on the outward grip button, not the tick anchor
    const jawBlock = markers.slice(
      markers.indexOf("dss-cal-jaw-anchor"),
      markers.indexOf("dss-cal-stem"),
    );
    assert.match(jawBlock, /dss-cal-jaw/);
    assert.doesNotMatch(jawBlock, /dss-cal-handle-ring/);
    assert.match(markers, /button[\s\S]*dss-cal-handle[\s\S]*dss-cal-handle-ring/);
    assert.match(markers, /connectorSegmentGeometry\(p1, p2, TICK_CONNECTOR_INSET_PX\)/);
    assert.doesNotMatch(markers, /CARD_LONG_EDGE|85\.6|pixelsPerMm/);
  });

  it("applies the same outward-grip model for card and finger modes", () => {
    assert.match(markers, /mode: "card" \| "finger"/);
    assert.match(markers, /mode === "card" \? "A" : "L"/);
    assert.match(markers, /mode === "card" \? "B" : "R"/);
    assert.match(markers, /className="dss-cal-handle-ring"/);
    assert.equal(
      (markers.match(/className="dss-cal-handle-ring"/g) || []).length,
      1,
    );
  });
});
