export type SkinTone = "light" | "medium" | "dark";
export type BandMetal = "yellow-gold" | "white-gold" | "rose-gold";
export type BandWidth = 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5;

export const SKIN_TONES = ["light", "medium", "dark"] as const satisfies readonly SkinTone[];
export const BAND_METALS = [
  "yellow-gold",
  "white-gold",
  "rose-gold",
] as const satisfies readonly BandMetal[];
export const BAND_WIDTHS = [2, 2.5, 3, 3.5, 4, 4.5, 5] as const satisfies readonly BandWidth[];

export const DEFAULT_BAND_METAL: BandMetal = "yellow-gold";
export const DEFAULT_BAND_WIDTH: BandWidth = 2;

export const BAND_ASSET_PUBLIC_DIR = "/diamond-tech-suite/finger/band-widths";

export const CANONICAL_BAND_ASSET_NAME =
  /^finger-(light|medium|dark)-(yellow-gold|white-gold|rose-gold)-(2|2\.5|3|3\.5|4|4\.5|5)\.png$/;

export function bandAssetFileName(
  skinTone: SkinTone,
  metal: BandMetal,
  bandWidth: BandWidth,
): string {
  return `finger-${skinTone}-${metal}-${bandWidth}.png`;
}

export function bandAssetSrc(
  skinTone: SkinTone,
  bandWidth: BandWidth,
  metal: BandMetal,
): string {
  return `${BAND_ASSET_PUBLIC_DIR}/${bandAssetFileName(skinTone, metal, bandWidth)}`;
}

type BandAssetTable = {
  readonly [S in SkinTone]: {
    readonly [W in BandWidth]: {
      readonly [M in BandMetal]: string;
    };
  };
};

function buildBandAssetTable(): BandAssetTable {
  const table = {} as {
    [S in SkinTone]: { [W in BandWidth]: { [M in BandMetal]: string } };
  };
  for (const skinTone of SKIN_TONES) {
    table[skinTone] = {} as { [W in BandWidth]: { [M in BandMetal]: string } };
    for (const bandWidth of BAND_WIDTHS) {
      table[skinTone][bandWidth] = {} as { [M in BandMetal]: string };
      for (const metal of BAND_METALS) {
        table[skinTone][bandWidth][metal] = bandAssetSrc(
          skinTone,
          bandWidth,
          metal,
        );
      }
    }
  }
  return table;
}

export const BAND_ASSETS: BandAssetTable = buildBandAssetTable();

export function expectedBandAssetCount(): number {
  return SKIN_TONES.length * BAND_WIDTHS.length * BAND_METALS.length;
}

/** Resolve a band raster. Missing keys are an architecture failure. */
export function getBandAssetSrc(
  skinTone: SkinTone,
  bandWidth: BandWidth,
  metal: BandMetal,
): string {
  const src = BAND_ASSETS[skinTone]?.[bandWidth]?.[metal];
  if (!src) {
    throw new Error(
      `Missing band asset for ${skinTone} / ${bandWidth} mm / ${metal}`,
    );
  }
  return src;
}

export function adjacentBandWidths(bandWidth: BandWidth): BandWidth[] {
  const index = BAND_WIDTHS.indexOf(bandWidth);
  const next: BandWidth[] = [];
  if (index > 0) next.push(BAND_WIDTHS[index - 1]!);
  if (index >= 0 && index < BAND_WIDTHS.length - 1) {
    next.push(BAND_WIDTHS[index + 1]!);
  }
  return next;
}
