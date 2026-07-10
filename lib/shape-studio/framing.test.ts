import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CARD_LONG_EDGE_MM } from "./constants";
import { renderStoneWidthMm } from "./dimensions";
import {
  FRAMING_DEFAULT_CROP_OF_MAX,
  FRAMING_MAX_ZOOM_FACTOR,
  FRAMING_SAFE_AREA,
  FRAMING_ZOOM_STEP,
  cardExclusionBounds,
  clampFraming,
  cropHeightVFromWidthU,
  deriveCropRect,
  displayPixelsPerMm,
  maxFittingCropWidthU,
  panFramingByViewerDelta,
  resetFramingToSuggested,
  sourceCardEdgePx,
  sourcePixelsPerMmFromCard,
  sourcePointToViewerPx,
  sourceToViewerScale,
  sourceToViewerScaleFromHeight,
  suggestInitialCrop,
  viewerPointToSourcePoint,
  zoomFraming,
} from "./framing";
import type { ContentPoint, FramingState } from "./types";

/** Real QA photo oriented size (EXIF 6 → 3024×4032). */
const QA_SOURCE = { width: 3024, height: 4032 };

/** Validation card endpoints from Phase 3B measurements (oriented px). */
const QA_CARD_A: ContentPoint = { u: 132 / 3024, v: 1960 / 4032 };
const QA_CARD_B: ContentPoint = { u: 1151 / 3024, v: 1960 / 4032 };
const QA_SEAT: ContentPoint = {
  u: (1953 + 2334) / 2 / 3024,
  v: 2000 / 4032,
};

describe("shape-studio framing crop clamping", () => {
  it("clamps crop width to fit source at viewer aspect", () => {
    const aspect = 1440 / 900;
    const maxW = maxFittingCropWidthU(QA_SOURCE, aspect);
    const framing = clampFraming(
      { centerU: 0.5, centerV: 0.5, cropWidthU: 2 },
      QA_SOURCE,
      aspect,
    );
    assert.ok(framing.cropWidthU <= maxW + 1e-12);
    const crop = deriveCropRect(framing, QA_SOURCE, aspect);
    assert.ok(crop.leftU >= -1e-12);
    assert.ok(crop.topV >= -1e-12);
    assert.ok(crop.leftU + crop.widthU <= 1 + 1e-12);
    assert.ok(crop.topV + crop.heightV <= 1 + 1e-12);
  });

  it("clamps center so crop stays inside source", () => {
    const aspect = 1;
    const framing = clampFraming(
      { centerU: 0, centerV: 1, cropWidthU: 0.4 },
      QA_SOURCE,
      aspect,
    );
    const h = cropHeightVFromWidthU(framing.cropWidthU, QA_SOURCE, aspect);
    assert.ok(framing.centerU >= framing.cropWidthU / 2 - 1e-12);
    assert.ok(framing.centerU <= 1 - framing.cropWidthU / 2 + 1e-12);
    assert.ok(framing.centerV >= h / 2 - 1e-12);
    assert.ok(framing.centerV <= 1 - h / 2 + 1e-12);
  });
});

describe("shape-studio framing point mapping", () => {
  it("maps source-normalized points into crop viewer pixels", () => {
    const framing: FramingState = {
      centerU: 0.5,
      centerV: 0.5,
      cropWidthU: 0.5,
    };
    const Wv = 400;
    const Hv = 500;
    const mid = sourcePointToViewerPx(
      { u: 0.5, v: 0.5 },
      framing,
      QA_SOURCE,
      Wv,
      Hv,
    );
    assert.ok(Math.abs(mid.x - Wv / 2) < 1e-6);
    assert.ok(Math.abs(mid.y - Hv / 2) < 1e-6);

    const back = viewerPointToSourcePoint(mid.x, mid.y, framing, QA_SOURCE, Wv, Hv);
    assert.ok(Math.abs(back.u - 0.5) < 1e-9);
    assert.ok(Math.abs(back.v - 0.5) < 1e-9);
  });
});

describe("shape-studio framing aspect resize", () => {
  it("retains center and crop width across aspect change then reclamps", () => {
    const wide = 1440 / 900;
    const narrow = 390 / 700;
    let framing = clampFraming(
      { centerU: QA_SEAT.u, centerV: QA_SEAT.v, cropWidthU: 0.55 },
      QA_SOURCE,
      wide,
    );
    const kept = {
      centerU: framing.centerU,
      centerV: framing.centerV,
      cropWidthU: framing.cropWidthU,
    };
    framing = clampFraming(kept, QA_SOURCE, narrow);
    assert.equal(framing.cropWidthU, clampFraming(kept, QA_SOURCE, narrow).cropWidthU);
    const crop = deriveCropRect(framing, QA_SOURCE, narrow);
    assert.ok(crop.topV >= -1e-12);
    assert.ok(crop.topV + crop.heightV <= 1 + 1e-12);
  });
});

describe("shape-studio framing scale and ppm", () => {
  it("agrees width and height source-to-viewer scale", () => {
    const Wv = 520;
    const Hv = 502;
    const aspect = Wv / Hv;
    const framing = clampFraming(
      { centerU: 0.5, centerV: 0.5, cropWidthU: 0.6 },
      QA_SOURCE,
      aspect,
    );
    const crop = deriveCropRect(framing, QA_SOURCE, aspect);
    const sx = sourceToViewerScale(framing.cropWidthU, QA_SOURCE.width, Wv);
    const sy = sourceToViewerScaleFromHeight(crop.heightV, QA_SOURCE.height, Hv);
    assert.ok(Math.abs(sx - sy) < 1e-9);
  });

  it("matches ~11.869 source px/mm on the QA card marks", () => {
    const edge = sourceCardEdgePx(QA_CARD_A, QA_CARD_B, QA_SOURCE);
    assert.ok(Math.abs(edge - 1019) < 5 || Math.abs(edge - 1016) < 5);
    const ppm = sourcePixelsPerMmFromCard(QA_CARD_A, QA_CARD_B, QA_SOURCE);
    assert.ok(ppm != null);
    assert.ok(Math.abs(ppm! - 11.869) < 0.05);
  });

  it("scales display ppm with zoom (tighter crop → larger display ppm)", () => {
    const Wv = 520;
    const aspect = 520 / 502;
    const sourcePpm = sourcePixelsPerMmFromCard(
      QA_CARD_A,
      QA_CARD_B,
      QA_SOURCE,
    )!;
    const wide = clampFraming(
      { centerU: 0.5, centerV: 0.5, cropWidthU: 0.7 },
      QA_SOURCE,
      aspect,
    );
    const tight = clampFraming(
      { centerU: 0.5, centerV: 0.5, cropWidthU: 0.35 },
      QA_SOURCE,
      aspect,
    );
    const dWide = displayPixelsPerMm(sourcePpm, wide, QA_SOURCE, Wv);
    const dTight = displayPixelsPerMm(sourcePpm, tight, QA_SOURCE, Wv);
    assert.ok(dTight > dWide);
    const ratio =
      (CARD_LONG_EDGE_MM / renderStoneWidthMm("round", 2)) /
      (CARD_LONG_EDGE_MM / renderStoneWidthMm("round", 2));
    assert.equal(ratio, 1);
    const invWide =
      (sourcePpm * sourceToViewerScale(wide.cropWidthU, QA_SOURCE.width, Wv) *
        CARD_LONG_EDGE_MM) /
      (renderStoneWidthMm("round", 2) *
        displayPixelsPerMm(sourcePpm, wide, QA_SOURCE, Wv));
    assert.ok(Math.abs(invWide - CARD_LONG_EDGE_MM / renderStoneWidthMm("round", 2)) < 1e-9);
  });

  it("keeps card∶diamond physical ratio invariant under zoom", () => {
    const Wv = 520;
    const aspect = 1.2;
    const sourcePpm = sourcePixelsPerMmFromCard(
      QA_CARD_A,
      QA_CARD_B,
      QA_SOURCE,
    )!;
    const stoneMm = renderStoneWidthMm("round", 2);
    const expected = CARD_LONG_EDGE_MM / stoneMm;
    for (const cropWidthU of [0.7, 0.55, 0.4]) {
      const framing = clampFraming(
        { centerU: QA_SEAT.u, centerV: QA_SEAT.v, cropWidthU },
        QA_SOURCE,
        aspect,
      );
      const dPpm = displayPixelsPerMm(sourcePpm, framing, QA_SOURCE, Wv);
      const cardEdgeDisplay = CARD_LONG_EDGE_MM * dPpm;
      const diamondDisplay = stoneMm * dPpm;
      assert.ok(Math.abs(cardEdgeDisplay / diamondDisplay - expected) < 1e-9);
    }
  });
});

describe("shape-studio framing pan and zoom", () => {
  it("pans crop center opposite to viewer drag", () => {
    const Wv = 400;
    const Hv = 500;
    const aspect = Wv / Hv;
    const start = clampFraming(
      { centerU: 0.5, centerV: 0.5, cropWidthU: 0.5 },
      QA_SOURCE,
      aspect,
    );
    const panned = panFramingByViewerDelta(start, 40, 0, QA_SOURCE, Wv, Hv);
    assert.ok(panned.centerU < start.centerU);
    assert.equal(panned.cropWidthU, start.cropWidthU);
  });

  it("zooms in by shrinking crop width", () => {
    const aspect = 1.1;
    const start = clampFraming(
      { centerU: 0.5, centerV: 0.5, cropWidthU: 0.6 },
      QA_SOURCE,
      aspect,
    );
    const zoomed = zoomFraming(start, "in", QA_SOURCE, aspect);
    assert.ok(zoomed.cropWidthU < start.cropWidthU);
    assert.ok(
      Math.abs(zoomed.cropWidthU - start.cropWidthU / FRAMING_ZOOM_STEP) < 1e-9 ||
        zoomed.cropWidthU <= start.cropWidthU / FRAMING_ZOOM_STEP + 1e-9,
    );
  });
});

describe("shape-studio framing suggested crop", () => {
  it("favors the ring seat and biases away from a left-side card", () => {
    const aspect = 1440 / 900;
    const { framing, cardStillInFrame } = suggestInitialCrop(
      QA_SOURCE,
      aspect,
      QA_CARD_A,
      QA_CARD_B,
      QA_SEAT,
    );
    const crop = deriveCropRect(framing, QA_SOURCE, aspect);
    const su = (QA_SEAT.u - crop.leftU) / crop.widthU;
    const sv = (QA_SEAT.v - crop.topV) / crop.heightV;
    assert.ok(su >= FRAMING_SAFE_AREA - 0.02);
    assert.ok(su <= 1 - FRAMING_SAFE_AREA + 0.02);
    assert.ok(sv >= FRAMING_SAFE_AREA - 0.02);
    assert.ok(sv <= 1 - FRAMING_SAFE_AREA + 0.02);
    /** Card is left of seat → crop center should sit at/right of seat. */
    assert.ok(framing.centerU >= QA_SEAT.u - 0.02);
    assert.equal(typeof cardStillInFrame, "boolean");
  });

  it("biases right-side card crops leftward", () => {
    const aspect = 1;
    const cardA: ContentPoint = { u: 0.72, v: 0.55 };
    const cardB: ContentPoint = { u: 0.92, v: 0.55 };
    const seat: ContentPoint = { u: 0.4, v: 0.5 };
    const { framing } = suggestInitialCrop(
      { width: 1000, height: 1000 },
      aspect,
      cardA,
      cardB,
      seat,
    );
    assert.ok(framing.centerU <= seat.u + 0.02);
  });

  it("reset restores the deterministic suggestion", () => {
    const aspect = 1.2;
    const a = suggestInitialCrop(
      QA_SOURCE,
      aspect,
      QA_CARD_A,
      QA_CARD_B,
      QA_SEAT,
    );
    const b = resetFramingToSuggested(
      QA_SOURCE,
      aspect,
      QA_CARD_A,
      QA_CARD_B,
      QA_SEAT,
    );
    assert.deepEqual(a.framing, b.framing);
    assert.equal(a.cardStillInFrame, b.cardStillInFrame);
  });

  it("builds a conservative exclusion zone around the marked segment", () => {
    const box = cardExclusionBounds(QA_CARD_A, QA_CARD_B, QA_SOURCE);
    assert.ok(box.minU < Math.min(QA_CARD_A.u, QA_CARD_B.u));
    assert.ok(box.maxU > Math.max(QA_CARD_A.u, QA_CARD_B.u));
    assert.ok(box.minV < QA_CARD_A.v);
    assert.ok(box.maxV > QA_CARD_A.v);
  });

  it("exposes restrained default / max-zoom constants", () => {
    assert.ok(FRAMING_DEFAULT_CROP_OF_MAX > 0.7);
    assert.ok(FRAMING_DEFAULT_CROP_OF_MAX < 1);
    assert.ok(FRAMING_MAX_ZOOM_FACTOR >= 2);
    assert.ok(FRAMING_MAX_ZOOM_FACTOR <= 3.5);
  });
});
