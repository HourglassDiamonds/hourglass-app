import type { ShapeId } from "./diamond-cad-types";

export type CadScintillationProfile = "brilliant" | "step";
export type CadShadowProfile = "round" | "square" | "elongated";

export type DiamondCadAsset = {
  shapeId: ShapeId;
  /** Facet-definition enhanced base. */
  src: string;
  /** Original normalized CAD (pre-enhancement). */
  originalSrc: string;
  /** Tightly cropped switcher thumbnail. */
  switcherSrc: string;
  /** Existing legacy shape PNG. */
  fallbackSrc: string;
  /** Four contrast-shift scintillation variants. */
  variants: readonly [string, string, string, string];
  /** Visible stone width ÷ canvas width (alpha > 10). */
  visibleFillRatio: number;
  /** Visible stone height ÷ canvas height (alpha > 10). */
  visibleFillRatioH: number;
  /** Stone centroid as fraction of canvas. */
  centerX: number;
  centerY: number;
  /** Scale so visible girdle matches legacy asset width fill. */
  visibleScale: number;
  /** Alpha-bounds of the visible stone on the CAD canvas. */
  visibleBounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
  canvas: { width: number; height: number };
  profile: CadScintillationProfile;
  shadow: CadShadowProfile;
};

const DIAMONDS = "/diamond-tech-suite/diamonds";

function cadPaths(prefix: "rbc" | ShapeIdExcludeRound, scintillationPrefix: string) {
  const base = prefix === "rbc" ? "rbc-cad" : `${prefix}-cad`;
  return {
    src: `${DIAMONDS}/${base}-pop.png`,
    originalSrc: `${DIAMONDS}/${base}.png`,
    switcherSrc: `${DIAMONDS}/${base}-switcher.png`,
    variants: [
      `${DIAMONDS}/${scintillationPrefix}-a.png`,
      `${DIAMONDS}/${scintillationPrefix}-b.png`,
      `${DIAMONDS}/${scintillationPrefix}-c.png`,
      `${DIAMONDS}/${scintillationPrefix}-d.png`,
    ] as const,
  };
}

type ShapeIdExcludeRound = Exclude<ShapeId, "round">;

/**
 * Shape-keyed CAD configuration for Diamond Studio V2.
 * Measurements from scripts/generate-diamond-cad-assets.mjs (alpha threshold 10).
 */
export const DIAMOND_CAD_ASSETS: Record<ShapeId, DiamondCadAsset> = {
  round: {
    shapeId: "round",
    ...cadPaths("rbc", "rbc-cad-scintillation"),
    fallbackSrc: `${DIAMONDS}/round.png`,
    visibleFillRatio: 1679 / 2560,
    visibleFillRatioH: 1676 / 2560,
    centerX: 1279.372774789823 / 2560,
    centerY: 1298.5843473789878 / 2560,
    visibleScale: (1420 / 1500) / (1679 / 2560),
    visibleBounds: {
      minX: 440,
      minY: 461,
      maxX: 2118,
      maxY: 2136,
      width: 1679,
      height: 1676,
    },
    canvas: { width: 2560, height: 2560 },
    profile: "brilliant",
    shadow: "round",
  },
  oval: {
    shapeId: "oval",
    ...cadPaths("oval", "oval-cad-scintillation"),
    fallbackSrc: `${DIAMONDS}/oval.png`,
    visibleFillRatio: 1170 / 2560,
    visibleFillRatioH: 1645 / 2560,
    centerX: 1279.4160729842997 / 2560,
    centerY: 1293.074660775135 / 2560,
    visibleScale: (976 / 1500) / (1170 / 2560),
    visibleBounds: {
      minX: 695,
      minY: 471,
      maxX: 1864,
      maxY: 2115,
      width: 1170,
      height: 1645,
    },
    canvas: { width: 2560, height: 2560 },
    profile: "brilliant",
    shadow: "elongated",
  },
  cushion: {
    shapeId: "cushion",
    ...cadPaths("cushion", "cushion-cad-scintillation"),
    fallbackSrc: `${DIAMONDS}/cushion.png`,
    visibleFillRatio: 1193 / 2560,
    visibleFillRatioH: 1206 / 2560,
    centerX: 1279.4244524163346 / 2560,
    centerY: 1272.9897140373807 / 2560,
    visibleScale: (1430 / 1500) / (1193 / 2560),
    visibleBounds: {
      minX: 683,
      minY: 672,
      maxX: 1875,
      maxY: 1877,
      width: 1193,
      height: 1206,
    },
    canvas: { width: 2560, height: 2560 },
    profile: "brilliant",
    shadow: "square",
  },
  princess: {
    shapeId: "princess",
    ...cadPaths("princess", "princess-cad-scintillation"),
    fallbackSrc: `${DIAMONDS}/princess.png`,
    visibleFillRatio: 1144 / 2560,
    visibleFillRatioH: 1156 / 2560,
    centerX: 1279.383240084809 / 2560,
    centerY: 1300.273942573841 / 2560,
    visibleScale: (1403 / 1500) / (1144 / 2560),
    visibleBounds: {
      minX: 708,
      minY: 723,
      maxX: 1851,
      maxY: 1878,
      width: 1144,
      height: 1156,
    },
    canvas: { width: 2560, height: 2560 },
    profile: "brilliant",
    shadow: "square",
  },
  marquise: {
    shapeId: "marquise",
    ...cadPaths("marquise", "marquise-cad-scintillation"),
    fallbackSrc: `${DIAMONDS}/marquise.png`,
    visibleFillRatio: 984 / 2560,
    visibleFillRatioH: 1969 / 2560,
    centerX: 1279.4106721012272 / 2560,
    centerY: 1289.9114980732213 / 2560,
    visibleScale: (651 / 1500) / (984 / 2560),
    visibleBounds: {
      minX: 788,
      minY: 306,
      maxX: 1771,
      maxY: 2274,
      width: 984,
      height: 1969,
    },
    canvas: { width: 2560, height: 2560 },
    profile: "brilliant",
    shadow: "elongated",
  },
  pear: {
    shapeId: "pear",
    ...cadPaths("pear", "pear-cad-scintillation"),
    fallbackSrc: `${DIAMONDS}/pear.png`,
    visibleFillRatio: 1162 / 2560,
    visibleFillRatioH: 1800 / 2560,
    centerX: 1279.425919558852 / 2560,
    centerY: 1324.1557968982108 / 2560,
    visibleScale: (847 / 1500) / (1162 / 2560),
    visibleBounds: {
      minX: 699,
      minY: 341,
      maxX: 1860,
      maxY: 2140,
      width: 1162,
      height: 1800,
    },
    canvas: { width: 2560, height: 2560 },
    profile: "brilliant",
    shadow: "elongated",
  },
  emerald: {
    shapeId: "emerald",
    ...cadPaths("emerald", "emerald-cad-scintillation"),
    fallbackSrc: `${DIAMONDS}/emerald.png`,
    visibleFillRatio: 972 / 2560,
    visibleFillRatioH: 1388 / 2560,
    centerX: 1279.3625243119516 / 2560,
    centerY: 1294.2561375920168 / 2560,
    visibleScale: (965 / 1500) / (972 / 2560),
    visibleBounds: {
      minX: 794,
      minY: 601,
      maxX: 1765,
      maxY: 1988,
      width: 972,
      height: 1388,
    },
    canvas: { width: 2560, height: 2560 },
    profile: "step",
    shadow: "elongated",
  },
  radiant: {
    shapeId: "radiant",
    ...cadPaths("radiant", "radiant-cad-scintillation"),
    fallbackSrc: `${DIAMONDS}/radiant.png`,
    visibleFillRatio: 1042 / 2560,
    visibleFillRatioH: 1480 / 2560,
    centerX: 1279.3988405758782 / 2560,
    centerY: 1291.3634827672822 / 2560,
    visibleScale: (978 / 1500) / (1042 / 2560),
    visibleBounds: {
      minX: 759,
      minY: 552,
      maxX: 1800,
      maxY: 2031,
      width: 1042,
      height: 1480,
    },
    canvas: { width: 2560, height: 2560 },
    profile: "brilliant",
    shadow: "elongated",
  },
  asscher: {
    shapeId: "asscher",
    ...cadPaths("asscher", "asscher-cad-scintillation"),
    fallbackSrc: `${DIAMONDS}/asscher.png`,
    visibleFillRatio: 1128 / 2560,
    visibleFillRatioH: 1134 / 2560,
    centerX: 1279.4882463844795 / 2560,
    centerY: 1307.5080394042193 / 2560,
    visibleScale: (1414 / 1500) / (1128 / 2560),
    visibleBounds: {
      minX: 716,
      minY: 741,
      maxX: 1843,
      maxY: 1874,
      width: 1128,
      height: 1134,
    },
    canvas: { width: 2560, height: 2560 },
    profile: "step",
    shadow: "square",
  },
};

export const DIAMOND_CAD_SHAPE_IDS = Object.keys(DIAMOND_CAD_ASSETS) as ShapeId[];

export function getDiamondCadAsset(shapeId: ShapeId): DiamondCadAsset {
  return DIAMOND_CAD_ASSETS[shapeId];
}

/** True when the URL is a CAD pop/original (not legacy or fallback). */
export function isCadStageSrc(src: string, asset: DiamondCadAsset): boolean {
  return src === asset.src || src === asset.originalSrc;
}

/** Next fallback in the CAD → original → legacy → DIAMOND_SHAPE_FALLBACK chain. */
export function nextCadFallbackSrc(
  current: string,
  asset: DiamondCadAsset,
  ultimateFallback: string,
): string {
  if (current === asset.src) return asset.originalSrc;
  if (current === asset.originalSrc) return asset.fallbackSrc;
  if (current === asset.fallbackSrc) return ultimateFallback;
  return current;
}
