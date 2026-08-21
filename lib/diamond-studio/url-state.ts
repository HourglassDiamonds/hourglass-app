import { ALL_SHAPE_IDS, type ShapeId } from "@/app/diamond-studio/components/diamond-cad-types";
import {
  BAND_METALS,
  BAND_WIDTHS,
  DEFAULT_BAND_METAL,
  DEFAULT_BAND_WIDTH,
  SKIN_TONES,
  type BandMetal,
  type BandWidth,
  type SkinTone,
} from "@/lib/diamond-studio/band-assets";

export type StudioSkinTone = SkinTone;
export type StudioOrientation = "ns" | "ew";
export type StudioBandWidth = BandWidth;
export type StudioBandMetal = BandMetal;

export type DiamondStudioUrlState = {
  shape: ShapeId;
  carat: number;
  ringSize: number;
  bandWidth: StudioBandWidth;
  skinTone: StudioSkinTone;
  orientation: StudioOrientation;
  metal: StudioBandMetal;
};

export const DIAMOND_STUDIO_URL_DEFAULTS: DiamondStudioUrlState = {
  shape: "round",
  carat: 2.5,
  ringSize: 6,
  bandWidth: DEFAULT_BAND_WIDTH,
  skinTone: "light",
  orientation: "ns",
  metal: DEFAULT_BAND_METAL,
};

export const STUDIO_BAND_WIDTHS: readonly StudioBandWidth[] = BAND_WIDTHS;
export const STUDIO_BAND_METALS: readonly StudioBandMetal[] = BAND_METALS;

const SKIN_TONE_SET = new Set<StudioSkinTone>(SKIN_TONES);
const METAL_SET = new Set<StudioBandMetal>(BAND_METALS);
const SHAPE_SET = new Set<string>(ALL_SHAPE_IDS);
const METAL_ALIASES: Record<string, StudioBandMetal> = {
  yellow: "yellow-gold",
  white: "white-gold",
  rose: "rose-gold",
  "yellow-gold": "yellow-gold",
  "white-gold": "white-gold",
  "rose-gold": "rose-gold",
};

const CARAT_MIN = 1;
const CARAT_MAX = 10;
const CARAT_STEP = 0.25;
const RING_MIN = 4;
const RING_MAX = 13;

export function snapStudioCarat(value: number): number {
  const snapped = Math.round(value / CARAT_STEP) * CARAT_STEP;
  return Math.max(
    CARAT_MIN,
    Math.min(CARAT_MAX, Math.round(snapped * 100) / 100),
  );
}

export function snapStudioRingSize(value: number): number {
  const stepped = Math.round(value * 2) / 2;
  return Math.max(RING_MIN, Math.min(RING_MAX, stepped));
}

function parseShape(raw: string | null): ShapeId | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  return SHAPE_SET.has(value) ? (value as ShapeId) : null;
}

function parseNumber(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parseBandWidth(raw: string | null): StudioBandWidth | null {
  const value = parseNumber(raw);
  if (value == null) return null;
  const match = STUDIO_BAND_WIDTHS.find((width) => Math.abs(width - value) < 0.001);
  return match ?? null;
}

function parseSkinTone(raw: string | null): StudioSkinTone | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase() as StudioSkinTone;
  return SKIN_TONE_SET.has(value) ? value : null;
}

function parseMetal(raw: string | null): StudioBandMetal | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  return METAL_ALIASES[value] ?? (METAL_SET.has(value as StudioBandMetal)
    ? (value as StudioBandMetal)
    : null);
}

function parseOrientation(raw: string | null): StudioOrientation | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (value === "ns" || value === "n-s" || value === "north-south") return "ns";
  if (value === "ew" || value === "e-w" || value === "east-west") return "ew";
  return null;
}

export type ParseStudioSearchParamsResult = {
  state: DiamondStudioUrlState;
  /** True when at least one recognized param was present and valid. */
  loadedFromUrl: boolean;
};

/** Parse and validate Studio query params; invalid values fall back to defaults. */
export function parseStudioSearchParams(
  search: string | URLSearchParams,
): ParseStudioSearchParamsResult {
  const params =
    typeof search === "string"
      ? new URLSearchParams(
          search.startsWith("?") ? search.slice(1) : search,
        )
      : search;

  const defaults = DIAMOND_STUDIO_URL_DEFAULTS;
  let loadedFromUrl = false;

  const shape = parseShape(params.get("shape"));
  const caratRaw = parseNumber(params.get("carat"));
  const ringSizeRaw = parseNumber(params.get("ringSize"));
  const bandWidth = parseBandWidth(params.get("bandWidth"));
  const skinTone = parseSkinTone(params.get("skinTone"));
  const orientation = parseOrientation(params.get("orientation"));
  const metal = parseMetal(params.get("metal"));

  const state: DiamondStudioUrlState = { ...defaults };

  if (shape) {
    state.shape = shape;
    loadedFromUrl = true;
  }
  if (caratRaw != null && caratRaw >= CARAT_MIN && caratRaw <= CARAT_MAX) {
    state.carat = snapStudioCarat(caratRaw);
    loadedFromUrl = true;
  }
  if (ringSizeRaw != null && ringSizeRaw >= RING_MIN && ringSizeRaw <= RING_MAX) {
    state.ringSize = snapStudioRingSize(ringSizeRaw);
    loadedFromUrl = true;
  }
  if (bandWidth != null) {
    state.bandWidth = bandWidth;
    loadedFromUrl = true;
  }
  if (skinTone) {
    state.skinTone = skinTone;
    loadedFromUrl = true;
  }
  if (orientation) {
    state.orientation = orientation;
    loadedFromUrl = true;
  }
  if (metal) {
    state.metal = metal;
    loadedFromUrl = true;
  }

  return { state, loadedFromUrl };
}

function formatCaratParam(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function formatRingSizeParam(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function formatBandWidthParam(value: StudioBandWidth): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

/** Build query string omitting defaults. Empty string when fully default. */
export function serializeStudioSearchParams(
  state: DiamondStudioUrlState,
  defaults: DiamondStudioUrlState = DIAMOND_STUDIO_URL_DEFAULTS,
): string {
  const params = new URLSearchParams();

  if (state.shape !== defaults.shape) {
    params.set("shape", state.shape);
  }
  if (Math.abs(state.carat - defaults.carat) >= 0.001) {
    params.set("carat", formatCaratParam(state.carat));
  }
  if (Math.abs(state.ringSize - defaults.ringSize) >= 0.001) {
    params.set("ringSize", formatRingSizeParam(state.ringSize));
  }
  if (Math.abs(state.bandWidth - defaults.bandWidth) >= 0.001) {
    params.set("bandWidth", formatBandWidthParam(state.bandWidth));
  }
  if (state.skinTone !== defaults.skinTone) {
    params.set("skinTone", state.skinTone);
  }
  if (state.orientation !== defaults.orientation) {
    params.set("orientation", state.orientation);
  }
  if (state.metal !== defaults.metal) {
    params.set("metal", state.metal);
  }

  return params.toString();
}

/** Absolute or path-relative Studio URL for the given configuration. */
export function buildStudioSharePath(
  state: DiamondStudioUrlState,
  pathname = "/diamond-studio",
): string {
  const query = serializeStudioSearchParams(state);
  return query ? `${pathname}?${query}` : pathname;
}

export function studioStatesEqual(
  a: DiamondStudioUrlState,
  b: DiamondStudioUrlState,
): boolean {
  return (
    a.shape === b.shape &&
    Math.abs(a.carat - b.carat) < 0.001 &&
    Math.abs(a.ringSize - b.ringSize) < 0.001 &&
    Math.abs(a.bandWidth - b.bandWidth) < 0.001 &&
    a.skinTone === b.skinTone &&
    a.orientation === b.orientation &&
    a.metal === b.metal
  );
}
