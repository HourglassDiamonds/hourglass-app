/**
 * Studio product-integrity health checks.
 * Repository evidence only — no live HTTP, no identity.
 */

import fs from "node:fs";
import path from "node:path";
import {
  BAND_METALS,
  BAND_WIDTHS,
  DEFAULT_BAND_WIDTH,
  SKIN_TONES,
  expectedBandAssetCount,
  getBandAssetSrc,
} from "@/lib/diamond-studio/band-assets";
import {
  DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
  buildSnapshotRequestPath,
  configurationSharePath,
  parseStudioSnapshotRequest,
} from "@/lib/diamond-studio/configuration";
import {
  buildStudioSharePath,
  parseStudioSearchParams,
  serializeStudioSearchParams,
} from "@/lib/diamond-studio/url-state";
import { expectedVisibleDiamondBox } from "@/lib/diamond-studio/stage-calibration";
import type { StudioHealthCheck, StudioHealthReport } from "./types";

const BAND_DIR = path.join(
  process.cwd(),
  "public",
  "diamond-tech-suite",
  "finger",
  "band-widths",
);

function check(
  id: StudioHealthCheck["id"],
  ok: boolean,
  detail: string,
): StudioHealthCheck {
  return { id, ok, detail };
}

export function runDiamondStudioHealthChecks(): StudioHealthReport {
  const expected = expectedBandAssetCount();
  let present = 0;
  let missing = 0;
  for (const skin of SKIN_TONES) {
    for (const width of BAND_WIDTHS) {
      for (const metal of BAND_METALS) {
        const src = getBandAssetSrc(skin, width, metal);
        const file = path.join(process.cwd(), "public", src.slice(1));
        if (fs.existsSync(file)) present += 1;
        else missing += 1;
      }
    }
  }

  const disk = fs.existsSync(BAND_DIR)
    ? fs.readdirSync(BAND_DIR).filter((f) => f.toLowerCase().endsWith(".png"))
    : [];

  const defaults = parseStudioSearchParams("");
  const white = parseStudioSearchParams("metal=white-gold&bandWidth=2.5");
  const rose = parseStudioSearchParams("shape=oval&metal=rose-gold&orientation=ew");
  const roundTrip = parseStudioSearchParams(
    serializeStudioSearchParams(white.state),
  );

  const snapshotDefault = parseStudioSnapshotRequest("");
  const snapshotBad = parseStudioSnapshotRequest("shape=hexagon");
  const snapshotPath = buildSnapshotRequestPath(
    DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
    "clean",
  );

  const box = expectedVisibleDiamondBox(DIAMOND_STUDIO_CONFIGURATION_DEFAULTS);

  const checks: StudioHealthCheck[] = [
    check(
      "band-asset-coverage",
      expected === 63 && present === expected && missing === 0,
      `${present}/${expected} band assets on disk`,
    ),
    check(
      "registry-paths",
      disk.length === expected && missing === 0,
      `${disk.length} canonical PNGs in band-widths directory`,
    ),
    check(
      "url-parse-serialize",
      roundTrip.state.metal === "white-gold" && roundTrip.state.bandWidth === 2.5,
      "White gold + 2.5 mm survives parse/serialize",
    ),
    check(
      "default-band-width",
      defaults.state.bandWidth === DEFAULT_BAND_WIDTH && DEFAULT_BAND_WIDTH === 2,
      `Default band width is ${defaults.state.bandWidth} mm`,
    ),
    check(
      "metal-preservation",
      white.state.metal === "white-gold" && rose.state.metal === "rose-gold",
      "White and rose gold parse from share URLs",
    ),
    check(
      "representative-share-links",
      configurationSharePath(rose.state).includes("orientation=ew") &&
        buildStudioSharePath(DIAMOND_STUDIO_CONFIGURATION_DEFAULTS) ===
          "/diamond-studio",
      "Default share path is bare /diamond-studio; EW oval keeps orientation",
    ),
    check(
      "snapshot-generation",
      snapshotDefault.ok &&
        !snapshotBad.ok &&
        snapshotPath.startsWith("/api/diamond-studio/snapshot"),
      "Snapshot request parser accepts defaults and rejects unsupported shapes",
    ),
    check(
      "snapshot-calibration",
      box.width > 0 &&
        box.height > 0 &&
        Math.abs(box.centerX - 578) < 80,
      `Default visible diamond box ${box.width.toFixed(1)}×${box.height.toFixed(1)}px`,
    ),
  ];

  const healthy = checks.every((c) => c.ok);
  return {
    healthy,
    checks,
    facts: checks.map((c) => `${c.id}: ${c.ok ? "ok" : "fail"} — ${c.detail}`),
    inferences: [
      "Health checks are repository evidence, not live production probes",
      "Anonymous Studio activity does not create client identity",
    ],
  };
}
