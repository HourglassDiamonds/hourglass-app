/** Local smoke-test asset for Round Brilliant CAD rendering in Diamond Size Studio. */
export const ROUND_CAD_ASSET = {
  /** Facet-definition enhanced base (local smoke test). */
  src: "/diamond-tech-suite/diamonds/rbc-cad-pop.png",
  /** Original render; unchanged fallback if pop asset is unavailable. */
  originalSrc: "/diamond-tech-suite/diamonds/rbc-cad.png",
  /** Tightly cropped static thumbnail for the shape switcher only. */
  switcherSrc: "/diamond-tech-suite/diamonds/rbc-cad-switcher.png",
  fallbackSrc: "/diamond-tech-suite/diamonds/round.png",
  /** Visible stone diameter ÷ canvas width (alpha > 10 bounds probe). */
  visibleFillRatio: 1679 / 2560,
  /** Stone centroid as fraction of canvas width/height. */
  centerX: 1279 / 2560,
  centerY: 1298.5 / 2560,
} as const;

/** Baseline round.png visible fill for object-fit:contain compensation. */
export const ROUND_BASELINE_VISIBLE_FILL = 1420 / 1500;

/** Scale the CAD frame so its visible girdle matches the legacy round asset. */
export const ROUND_CAD_VISIBLE_SCALE =
  ROUND_BASELINE_VISIBLE_FILL / ROUND_CAD_ASSET.visibleFillRatio;
