/**
 * Resolve Studio raster assets from the typed registry only.
 * User-supplied filesystem paths are never accepted.
 */

import path from "node:path";
import { getDiamondCadAsset } from "@/app/diamond-studio/components/diamond-cad-assets";
import type { ShapeId } from "@/app/diamond-studio/components/diamond-cad-types";
import {
  BAND_ASSET_PUBLIC_DIR,
  getBandAssetSrc,
  type BandMetal,
  type BandWidth,
  type SkinTone,
} from "@/lib/diamond-studio/band-assets";

const PUBLIC_ROOT = path.join(process.cwd(), "public");
const ASSET_PREFIXES = [
  "/diamond-tech-suite/finger/band-widths/",
  "/diamond-tech-suite/diamonds-v2/",
] as const;

export function publicUrlToFilesystemPath(publicUrl: string): string {
  if (!publicUrl.startsWith("/") || publicUrl.includes("..") || publicUrl.includes("\\")) {
    throw new Error("Rejected asset path");
  }
  const allowed = ASSET_PREFIXES.some((prefix) => publicUrl.startsWith(prefix));
  if (!allowed) {
    throw new Error("Asset path is outside the Studio registry");
  }
  if (publicUrl !== path.posix.normalize(publicUrl)) {
    throw new Error("Rejected non-canonical asset path");
  }
  return path.join(PUBLIC_ROOT, ...publicUrl.slice(1).split("/"));
}

export function bandAssetFilesystemPath(
  skinTone: SkinTone,
  bandWidth: BandWidth,
  metal: BandMetal,
): string {
  const src = getBandAssetSrc(skinTone, bandWidth, metal);
  if (!src.startsWith(`${BAND_ASSET_PUBLIC_DIR}/`)) {
    throw new Error("Band asset escaped registry directory");
  }
  return publicUrlToFilesystemPath(src);
}

export function diamondAssetFilesystemPath(shape: ShapeId): string {
  return publicUrlToFilesystemPath(getDiamondCadAsset(shape).src);
}
