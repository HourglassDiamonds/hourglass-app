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

type DeliveredCadOpts = {
  profile: CadScintillationProfile;
  shadow: CadShadowProfile;
  visibleBounds: DiamondCadAsset["visibleBounds"];
  centerX: number;
  centerY: number;
  visibleFillRatio: number;
  visibleFillRatioH: number;
  visibleScale: number;
};

function deliveredCadAsset(
  shapeId: ShapeIdExcludeRound,
  opts: DeliveredCadOpts,
): DiamondCadAsset {
  const src = `${DIAMONDS}/diamond-${shapeId}-cad-3ct.png`;
  return {
    shapeId,
    src,
    originalSrc: src,
    switcherSrc: `${DIAMONDS}/diamond-${shapeId}-cad-3ct-switcher.png`,
    fallbackSrc: `${DIAMONDS}/${shapeId}.png`,
    variants: [],
    scintillationEnabled: false,
    canvas: { width: 2560, height: 2560 },
    ...opts,
  };
}

export const DIAMOND_CAD_ASSETS: Record<ShapeId, DiamondCadAsset> = {
  round: {
    shapeId: "round",
    ...cadPaths("rbc", "rbc-cad-scintillation"),
    scintillationEnabled: true,
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
  oval: deliveredCadAsset("oval", {
    profile: "brilliant",
    shadow: "elongated",
    visibleFillRatio: 1170 / 2560,
    visibleFillRatioH: 1645 / 2560,
    centerX: 0.4997719035094921,
    centerY: 0.5051072893652871,
    visibleScale: (976 / 1500) / (1170 / 2560),
    visibleBounds: { minX: 695, minY: 471, maxX: 1864, maxY: 2115, width: 1170, height: 1645 },
  }),
  cushion: deliveredCadAsset("cushion", {
    profile: "brilliant",
    shadow: "square",
    visibleFillRatio: 1193 / 2560,
    visibleFillRatioH: 1206 / 2560,
    centerX: 0.4997751767251307,
    centerY: 0.49726160704585187,
    visibleScale: (1430 / 1500) / (1193 / 2560),
    visibleBounds: { minX: 683, minY: 672, maxX: 1875, maxY: 1877, width: 1193, height: 1206 },
  }),
  princess: deliveredCadAsset("princess", {
    profile: "brilliant",
    shadow: "square",
    visibleFillRatio: 1144 / 2560,
    visibleFillRatioH: 1156 / 2560,
    centerX: 0.4997590781581285,
    centerY: 0.5079195088179066,
    visibleScale: (1403 / 1500) / (1144 / 2560),
    visibleBounds: { minX: 708, minY: 723, maxX: 1851, maxY: 1878, width: 1144, height: 1156 },
  }),
  marquise: deliveredCadAsset("marquise", {
    profile: "brilliant",
    shadow: "elongated",
    visibleFillRatio: 984 / 2560,
    visibleFillRatioH: 1969 / 2560,
    centerX: 0.4997697937895419,
    centerY: 0.5038716789348521,
    visibleScale: (651 / 1500) / (984 / 2560),
    visibleBounds: { minX: 788, minY: 306, maxX: 1771, maxY: 2274, width: 984, height: 1969 },
  }),
  pear: deliveredCadAsset("pear", {
    profile: "brilliant",
    shadow: "elongated",
    visibleFillRatio: 1162 / 2560,
    visibleFillRatioH: 1800 / 2560,
    centerX: 0.4997757498276766,
    centerY: 0.5172483581633636,
    visibleScale: (847 / 1500) / (1162 / 2560),
    visibleBounds: { minX: 699, minY: 341, maxX: 1860, maxY: 2140, width: 1162, height: 1800 },
  }),
  emerald: deliveredCadAsset("emerald", {
    profile: "step",
    shadow: "elongated",
    visibleFillRatio: 972 / 2560,
    visibleFillRatioH: 1388 / 2560,
    centerX: 0.4997509860593561,
    centerY: 0.5055688037468815,
    visibleScale: (965 / 1500) / (972 / 2560),
    visibleBounds: { minX: 794, minY: 601, maxX: 1765, maxY: 1988, width: 972, height: 1388 },
  }),
  radiant: deliveredCadAsset("radiant", {
    profile: "brilliant",
    shadow: "elongated",
    visibleFillRatio: 1042 / 2560,
    visibleFillRatioH: 1480 / 2560,
    centerX: 0.4997651720999524,
    centerY: 0.5044388604559696,
    visibleScale: (978 / 1500) / (1042 / 2560),
    visibleBounds: { minX: 759, minY: 552, maxX: 1800, maxY: 2031, width: 1042, height: 1480 },
  }),
  asscher: deliveredCadAsset("asscher", {
    profile: "step",
    shadow: "square",
    visibleFillRatio: 1128 / 2560,
    visibleFillRatioH: 1134 / 2560,
    centerX: 0.4998000962439373,
    centerY: 0.5107453278922731,
    visibleScale: (1414 / 1500) / (1128 / 2560),
    visibleBounds: { minX: 716, minY: 741, maxX: 1843, maxY: 1874, width: 1128, height: 1134 },
  }),
};

export const DELIVERED_CAD_SHAPE_IDS = ALL_SHAPE_IDS.filter(
  (id) => id !== "round",
) as Exclude<ShapeId, "round">[];

export const DIAMOND_CAD_SHAPE_IDS = Object.keys(DIAMOND_CAD_ASSETS) as ShapeId[];

export function getDiamondCadAsset(shapeId: ShapeId): DiamondCadAsset {
  return DIAMOND_CAD_ASSETS[shapeId];
}

export function isCadStageSrc(src: string, asset: DiamondCadAsset): boolean {
  return src === asset.src || src === asset.originalSrc;
}

export function nextCadFallbackSrc(
  current: string,
  asset: DiamondCadAsset,
  ultimateFallback: string,
): string {
  if (current === asset.src) {
    if (asset.src === asset.originalSrc) return asset.fallbackSrc;
    return asset.originalSrc;
  }
  if (current === asset.originalSrc) return asset.fallbackSrc;
  if (current === asset.fallbackSrc) return ultimateFallback;
  return current;
}
