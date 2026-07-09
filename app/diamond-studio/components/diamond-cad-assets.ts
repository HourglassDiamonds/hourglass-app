import type { ShapeId } from "./diamond-cad-types";
import { ALL_SHAPE_IDS } from "./diamond-cad-types";

export type CadScintillationProfile = "brilliant" | "step";
export type CadShadowProfile = "round" | "square" | "elongated";

export type DiamondCadAsset = {
  shapeId: ShapeId;
  src: string;
  originalSrc: string;
  switcherSrc: string;
  fallbackSrc: string;
  variants: readonly string[];
  scintillationEnabled: boolean;
  visibleFillRatio: number;
  visibleFillRatioH: number;
  centerX: number;
  centerY: number;
  visibleScale: number;
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

const DIAMONDS_V2 = "/diamond-tech-suite/diamonds-v2";

function v2Path(shapeId: ShapeId): string {
  return `${DIAMONDS_V2}/diamond-${shapeId}-v2.png`;
}

type V2AssetOpts = {
  profile: CadScintillationProfile;
  shadow: CadShadowProfile;
  visibleBounds: DiamondCadAsset["visibleBounds"];
  centerX: number;
  centerY: number;
  visibleFillRatio: number;
  visibleFillRatioH: number;
  visibleScale: number;
};

function v2Asset(shapeId: ShapeId, opts: V2AssetOpts): DiamondCadAsset {
  const src = v2Path(shapeId);
  return {
    shapeId,
    src,
    originalSrc: src,
    switcherSrc: src,
    fallbackSrc: src,
    variants: [],
    scintillationEnabled: false,
    canvas: { width: 2560, height: 2560 },
    ...opts,
  };
}

/** V2 diamond PNG bounds (alpha > 10) probed from public/diamond-tech-suite/diamonds-v2. */
export const DIAMOND_CAD_ASSETS: Record<ShapeId, DiamondCadAsset> = {
  round: v2Asset("round", {
    profile: "brilliant",
    shadow: "round",
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
  }),
  oval: v2Asset("oval", {
    profile: "brilliant",
    shadow: "elongated",
    visibleFillRatio: 1403 / 2560,
    visibleFillRatioH: 1971 / 2560,
    centerX: 1279.3721821611136 / 2560,
    centerY: 1295.6192149422582 / 2560,
    visibleScale: (976 / 1500) / (1403 / 2560),
    visibleBounds: {
      minX: 578,
      minY: 310,
      maxX: 1981,
      maxY: 2281,
      width: 1403,
      height: 1971,
    },
  }),
  cushion: v2Asset("cushion", {
    profile: "brilliant",
    shadow: "square",
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
  }),
  princess: v2Asset("princess", {
    profile: "brilliant",
    shadow: "square",
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
  }),
  marquise: v2Asset("marquise", {
    profile: "brilliant",
    shadow: "elongated",
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
  }),
  pear: v2Asset("pear", {
    profile: "brilliant",
    shadow: "elongated",
    visibleFillRatio: 1235 / 2560,
    visibleFillRatioH: 1972 / 2560,
    centerX: 1279.332853772129 / 2560,
    centerY: 1407.8543785824193 / 2560,
    visibleScale: (847 / 1500) / (1235 / 2560),
    visibleBounds: {
      minX: 662,
      minY: 309,
      maxX: 1896,
      maxY: 2280,
      width: 1235,
      height: 1972,
    },
  }),
  emerald: v2Asset("emerald", {
    profile: "step",
    shadow: "elongated",
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
  }),
  radiant: v2Asset("radiant", {
    profile: "brilliant",
    shadow: "elongated",
    visibleFillRatio: 1388 / 2560,
    visibleFillRatioH: 1971 / 2560,
    centerX: 1279.3804064450032 / 2560,
    centerY: 1295.1410878271397 / 2560,
    visibleScale: (978 / 1500) / (1388 / 2560),
    visibleBounds: {
      minX: 585,
      minY: 310,
      maxX: 1973,
      maxY: 2281,
      width: 1388,
      height: 1971,
    },
  }),
  asscher: v2Asset("asscher", {
    profile: "step",
    shadow: "square",
    visibleFillRatio: 1668 / 2560,
    visibleFillRatioH: 1675 / 2560,
    centerX: 1279.3406576788173 / 2560,
    centerY: 1304.8259921639321 / 2560,
    visibleScale: (1414 / 1500) / (1668 / 2560),
    visibleBounds: {
      minX: 446,
      minY: 468,
      maxX: 2113,
      maxY: 2142,
      width: 1668,
      height: 1675,
    },
  }),
};

export const DIAMOND_V2_SHAPE_IDS = ALL_SHAPE_IDS;

export const DIAMOND_CAD_SHAPE_IDS = Object.keys(DIAMOND_CAD_ASSETS) as ShapeId[];

export function getDiamondCadAsset(shapeId: ShapeId): DiamondCadAsset {
  return DIAMOND_CAD_ASSETS[shapeId];
}

export function isCadStageSrc(src: string, asset: DiamondCadAsset): boolean {
  return src === asset.src;
}

export function nextCadFallbackSrc(
  current: string,
  asset: DiamondCadAsset,
  ultimateFallback: string,
): string {
  void ultimateFallback;
  if (current === asset.src) return asset.src;
  return current;
}
