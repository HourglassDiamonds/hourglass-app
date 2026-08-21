/**
 * Single typed Studio configuration contract.
 *
 * Used by the live Studio, snapshot generation, Email This View,
 * structured Studio events, and Concierge handoff. Field names match
 * Phase A URL state (`metal`, not `bandMetal`) so existing parse/serialize
 * and share links stay unchanged.
 */

import type { ShapeId } from "@/app/diamond-studio/components/diamond-cad-types";
import {
  BAND_METALS,
  BAND_WIDTHS,
  SKIN_TONES,
  type BandMetal,
  type BandWidth,
  type SkinTone,
} from "@/lib/diamond-studio/band-assets";
import {
  DIAMOND_STUDIO_URL_DEFAULTS,
  buildStudioSharePath,
  parseStudioSearchParams,
  serializeStudioSearchParams,
  studioStatesEqual,
  type DiamondStudioUrlState,
  type StudioOrientation,
} from "@/lib/diamond-studio/url-state";

export type DiamondStudioConfiguration = DiamondStudioUrlState;

export type {
  BandMetal,
  BandWidth,
  ShapeId,
  SkinTone,
  StudioOrientation,
};

export const DIAMOND_STUDIO_CONFIGURATION_DEFAULTS: DiamondStudioConfiguration =
  DIAMOND_STUDIO_URL_DEFAULTS;

export const STUDIO_SNAPSHOT_VARIANTS = ["clean", "card"] as const;
export type StudioSnapshotVariant = (typeof STUDIO_SNAPSHOT_VARIANTS)[number];

const SNAPSHOT_QUERY_KEYS = new Set([
  "shape",
  "carat",
  "ringSize",
  "bandWidth",
  "skinTone",
  "orientation",
  "metal",
  "variant",
]);

const CONFIGURATION_OBJECT_KEYS = new Set([
  "shape",
  "carat",
  "ringSize",
  "bandWidth",
  "skinTone",
  "orientation",
  "metal",
]);

export const SHAPE_DISPLAY_LABELS: Record<ShapeId, string> = {
  round: "Round",
  oval: "Oval",
  cushion: "Cushion",
  princess: "Princess",
  marquise: "Marquise",
  pear: "Pear",
  emerald: "Emerald",
  radiant: "Radiant",
  asscher: "Asscher",
};

export const METAL_DISPLAY_LABELS: Record<BandMetal, string> = {
  "yellow-gold": "Yellow Gold",
  "white-gold": "White Gold",
  "rose-gold": "Rose Gold",
};

const ELONGATED_SHAPES = new Set<ShapeId>([
  "oval",
  "marquise",
  "pear",
  "emerald",
  "radiant",
]);

export function isStudioSnapshotVariant(
  value: string | null,
): value is StudioSnapshotVariant {
  return value === "clean" || value === "card";
}

export function configurationsEqual(
  a: DiamondStudioConfiguration,
  b: DiamondStudioConfiguration,
): boolean {
  return studioStatesEqual(a, b);
}

export function studioConfigurationFromSearch(
  search: string | URLSearchParams,
): DiamondStudioConfiguration {
  return parseStudioSearchParams(search).state;
}

export type StrictStudioParseResult =
  | { ok: true; state: DiamondStudioConfiguration; variant: StudioSnapshotVariant }
  | { ok: false; error: "unsupported_configuration"; invalidParams: string[] };

/**
 * Snapshot/API parse: present-but-unsupported values are rejected.
 * Absent values fall back to Studio defaults. Unknown keys are rejected
 * so callers cannot smuggle filesystem paths or PII.
 */
export function parseStudioSnapshotRequest(
  search: string | URLSearchParams,
): StrictStudioParseResult {
  const params =
    typeof search === "string"
      ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
      : search;

  const invalid: string[] = [];

  for (const key of params.keys()) {
    if (!SNAPSHOT_QUERY_KEYS.has(key)) invalid.push(key);
  }

  let variant: StudioSnapshotVariant = "clean";
  const variantRaw = params.get("variant");
  if (variantRaw != null && variantRaw.trim() !== "") {
    if (isStudioSnapshotVariant(variantRaw)) variant = variantRaw;
    else invalid.push("variant");
  }

  const parsed = parseStudioSearchParams(params);

  const checkPresent = (key: string, accepted: boolean) => {
    const raw = params.get(key);
    if (raw == null || raw.trim() === "") return;
    if (!accepted) invalid.push(key);
  };

  checkPresent("shape", params.get("shape") === parsed.state.shape);
  const caratRaw = params.get("carat");
  if (caratRaw != null && caratRaw.trim() !== "") {
    const n = Number(caratRaw);
    if (!Number.isFinite(n) || Math.abs(n - parsed.state.carat) >= 0.001) {
      invalid.push("carat");
    }
  }
  const ringRaw = params.get("ringSize");
  if (ringRaw != null && ringRaw.trim() !== "") {
    const n = Number(ringRaw);
    if (!Number.isFinite(n) || Math.abs(n - parsed.state.ringSize) >= 0.001) {
      invalid.push("ringSize");
    }
  }
  const widthRaw = params.get("bandWidth");
  if (widthRaw != null && widthRaw.trim() !== "") {
    const n = Number(widthRaw);
    const allowed = (BAND_WIDTHS as readonly number[]).some(
      (w) => Math.abs(w - n) < 0.001,
    );
    if (!allowed) invalid.push("bandWidth");
  }
  const skinRaw = params.get("skinTone");
  if (skinRaw != null && skinRaw.trim() !== "") {
    if (!(SKIN_TONES as readonly string[]).includes(skinRaw.trim().toLowerCase())) {
      invalid.push("skinTone");
    }
  }
  const metalRaw = params.get("metal");
  if (metalRaw != null && metalRaw.trim() !== "") {
    if (parsed.state.metal === DIAMOND_STUDIO_URL_DEFAULTS.metal) {
      const normalized = metalRaw.trim().toLowerCase();
      const aliases = ["yellow", "white", "rose", "yellow-gold", "white-gold", "rose-gold"];
      const isKnown =
        aliases.includes(normalized) ||
        (BAND_METALS as readonly string[]).includes(normalized);
      if (!isKnown) invalid.push("metal");
    }
  }
  const orientationRaw = params.get("orientation");
  if (orientationRaw != null && orientationRaw.trim() !== "") {
    const v = orientationRaw.trim().toLowerCase();
    const ok =
      v === "ns" ||
      v === "ew" ||
      v === "n-s" ||
      v === "e-w" ||
      v === "north-south" ||
      v === "east-west";
    if (!ok) invalid.push("orientation");
  }

  const uniqueInvalid = [...new Set(invalid)];
  if (uniqueInvalid.length > 0) {
    return {
      ok: false,
      error: "unsupported_configuration",
      invalidParams: uniqueInvalid,
    };
  }

  return { ok: true, state: parsed.state, variant };
}

/**
 * Typed configuration body for Email This View / identified events.
 * Unknown properties are rejected. Values are reparsed through the
 * snapshot contract — client state is never trusted as-is.
 */
export function parseStudioConfigurationObject(
  value: unknown,
): StrictStudioParseResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      error: "unsupported_configuration",
      invalidParams: ["configuration"],
    };
  }
  const record = value as Record<string, unknown>;
  const unknownKeys: string[] = [];
  for (const key of Object.keys(record)) {
    if (!CONFIGURATION_OBJECT_KEYS.has(key)) unknownKeys.push(key);
  }

  const params = new URLSearchParams();
  for (const key of CONFIGURATION_OBJECT_KEYS) {
    const raw = record[key];
    if (raw == null || raw === "") continue;
    if (typeof raw === "object") {
      unknownKeys.push(key);
      continue;
    }
    params.set(key, String(raw));
  }

  const parsed = parseStudioSnapshotRequest(params);
  if (!parsed.ok) {
    return {
      ok: false,
      error: "unsupported_configuration",
      invalidParams: [...new Set([...parsed.invalidParams, ...unknownKeys])],
    };
  }
  if (unknownKeys.length > 0) {
    return {
      ok: false,
      error: "unsupported_configuration",
      invalidParams: [...new Set(unknownKeys)],
    };
  }
  return parsed;
}

export function buildSnapshotRequestPath(
  state: DiamondStudioConfiguration,
  variant: StudioSnapshotVariant,
): string {
  const params = new URLSearchParams(serializeStudioSearchParams(state));
  params.set("variant", variant);
  return `/api/diamond-studio/snapshot?${params.toString()}`;
}

export function configurationSharePath(
  state: DiamondStudioConfiguration,
  pathname = "/diamond-studio",
): string {
  return buildStudioSharePath(state, pathname);
}

export type StudioCardCopy = {
  headline: string;
  detail: string;
  orientationLine: string | null;
};

export function formatCaratForCard(carat: number): string {
  return carat.toFixed(2);
}

export function formatRingSizeForCard(ringSize: number): string {
  const stepped = Math.round(ringSize * 2) / 2;
  return Number.isInteger(stepped) ? String(stepped) : stepped.toFixed(1);
}

export function formatBandWidthForCard(bandWidth: BandWidth): string {
  return Number.isInteger(bandWidth) ? `${bandWidth}.0 mm` : `${bandWidth} mm`;
}

export function formatOrientationForCard(orientation: StudioOrientation): string {
  return orientation === "ew" ? "E/W orientation" : "N/S orientation";
}

export function shouldShowOrientationLine(
  shape: ShapeId,
  orientation: StudioOrientation,
): boolean {
  return orientation === "ew" || ELONGATED_SHAPES.has(shape);
}

export function snapshotDownloadFilename(
  state: DiamondStudioConfiguration,
  variant: StudioSnapshotVariant,
): string {
  const kind = variant === "card" ? "card" : "view";
  return `hourglass-studio-${state.shape}-${formatCaratForCard(state.carat)}ct-${kind}.jpg`;
}

export function formatStudioCardCopy(
  state: DiamondStudioConfiguration,
): StudioCardCopy {
  const headline = `${formatCaratForCard(state.carat)} ct ${SHAPE_DISPLAY_LABELS[state.shape]}`;
  const detail = `Size ${formatRingSizeForCard(state.ringSize)} · ${formatBandWidthForCard(state.bandWidth)} ${METAL_DISPLAY_LABELS[state.metal]}`;
  const orientationLine = shouldShowOrientationLine(state.shape, state.orientation)
    ? formatOrientationForCard(state.orientation)
    : null;
  return { headline, detail, orientationLine };
}
