/**
 * Shape-aware scintillation variant generation for Diamond Studio CAD renders.
 * Brilliant/modified-brilliant: restrained multi-facet contrast shifts.
 * Step cuts: fewer, broader, orderly hall-of-mirrors shifts.
 */
import path from "path";
import { PNG } from "pngjs";
import {
  OPAQUE_ALPHA,
  boxBlur,
  clampByte,
  luminance,
  loadPng,
  writePng,
  publicDiamondPath,
} from "./diamond-cad-common.mjs";

const PATTERN_KEYS = ["a", "b", "c", "d"];

const BRILLIANT = {
  brightLumMin: 225,
  brightLumMax: 254,
  darkLumMin: 70,
  darkLumMax: 205,
  trueCentralLumMin: 85,
  trueCentralLumMax: 215,
  trueCentralPixelRadius: 0.225,
  trueCentralCentroidMin: 0.05,
  trueCentralCentroidMax: 0.24,
  nearCentralCentroidMin: 0.22,
  nearCentralCentroidMax: 0.34,
  nearCentralPixelRadius: 0.35,
  minRegionPx: 50,
  minTrueCentralPx: 200,
  minNearCentralPx: 350,
  minBrightMediumPx: 550,
  minBrightSmallPx: 280,
  minOuterDarkMediumPx: 450,
  minOuterDarkSmallPx: 320,
  largeCentralMinPx: 600,
  mediumCentralMinPx: 350,
  maxRegionPx: 4500,
  maxRegionFrac: 0.0008,
  girdleInsetPx: 6,
  featherRadius: 1,
  regionExpandRadius: 10,
  centralExpandRadius: 12,
  maxBrightPerPattern: 6,
  minBrightPerPattern: 3,
  maxOuterDarkPerPattern: 5,
  minOuterDarkPerPattern: 2,
  targetAreaMin: 0.04,
  targetAreaMax: 0.055,
  brightLift: 15,
  smallDarkMult: 0.83,
  centralDarkMult: 0.86,
  numCentralSectors: 16,
  numNearCentralSectors: 8,
};

const STEP = {
  brightLumMin: 200,
  brightLumMax: 252,
  darkLumMin: 55,
  darkLumMax: 195,
  trueCentralLumMin: 70,
  trueCentralLumMax: 210,
  trueCentralPixelRadius: 0.42,
  trueCentralCentroidMin: 0.02,
  trueCentralCentroidMax: 0.35,
  nearCentralCentroidMin: 0.2,
  nearCentralCentroidMax: 0.55,
  nearCentralPixelRadius: 0.62,
  minRegionPx: 400,
  minTrueCentralPx: 1400,
  minNearCentralPx: 1000,
  minBrightMediumPx: 2800,
  minBrightSmallPx: 1400,
  minOuterDarkMediumPx: 2400,
  minOuterDarkSmallPx: 1200,
  largeCentralMinPx: 3500,
  mediumCentralMinPx: 1800,
  maxRegionPx: 18000,
  maxRegionFrac: 0.0025,
  girdleInsetPx: 10,
  featherRadius: 2,
  regionExpandRadius: 10,
  centralExpandRadius: 12,
  maxBrightPerPattern: 2,
  minBrightPerPattern: 1,
  maxOuterDarkPerPattern: 2,
  minOuterDarkPerPattern: 1,
  targetAreaMin: 0.025,
  targetAreaMax: 0.04,
  brightLift: 8,
  smallDarkMult: 0.91,
  centralDarkMult: 0.93,
  numCentralSectors: 8,
  numNearCentralSectors: 4,
};

function cfgFor(profile) {
  return profile === "step" ? STEP : BRILLIANT;
}

function sizeTier(size, cfg) {
  if (size >= cfg.largeCentralMinPx) return "large";
  if (size >= cfg.mediumCentralMinPx) return "medium";
  return "small";
}

function tierCounts(regions, cfg) {
  const counts = { small: 0, medium: 0, large: 0 };
  for (const r of regions) counts[sizeTier(r.size, cfg)]++;
  return counts;
}

function neighbors4(i, x, y, width, height) {
  const out = [];
  if (x > 0) out.push(i - 1);
  if (x < width - 1) out.push(i + 1);
  if (y > 0) out.push(i - width);
  if (y < height - 1) out.push(i + width);
  return out;
}

function buildStoneMaps(png) {
  const { width, height, data } = png;
  const n = width * height;
  const opaque = new Uint8Array(n);
  const lum = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (data[o + 3] < OPAQUE_ALPHA) continue;
    opaque[i] = 1;
    lum[i] = luminance(data[o], data[o + 1], data[o + 2]);
  }

  const edgeDist = new Int32Array(n).fill(99999);
  const queue = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (opaque[i]) continue;
      edgeDist[i] = 0;
      queue.push(i);
    }
  }
  let qi = 0;
  while (qi < queue.length) {
    const i = queue[qi++];
    const x = i % width;
    const y = (i / width) | 0;
    const d = edgeDist[i] + 1;
    for (const ni of neighbors4(i, x, y, width, height)) {
      if (!opaque[ni] || edgeDist[ni] <= d) continue;
      edgeDist[ni] = d;
      queue.push(ni);
    }
  }

  let cx = 0;
  let cy = 0;
  let stonePx = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let i = 0; i < n; i++) {
    if (!opaque[i]) continue;
    const x = i % width;
    const y = (i / width) | 0;
    cx += x;
    cy += y;
    stonePx++;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  cx /= stonePx;
  cy /= stonePx;

  let stoneRadius = 0;
  for (let i = 0; i < n; i++) {
    if (!opaque[i]) continue;
    const dx = (i % width) - cx;
    const dy = ((i / width) | 0) - cy;
    stoneRadius = Math.max(stoneRadius, Math.hypot(dx, dy));
  }

  return {
    width,
    height,
    data,
    opaque,
    lum,
    edgeDist,
    cx,
    cy,
    stoneRadius,
    stonePx,
    n,
    boundsW: maxX - minX + 1,
    boundsH: maxY - minY + 1,
    minX,
    minY,
    maxX,
    maxY,
  };
}

function centralFractionAt(pixels, maps, radiusNorm) {
  const { width, cx, cy, stoneRadius } = maps;
  let n = 0;
  for (const pi of pixels) {
    const x = pi % width;
    const y = (pi / width) | 0;
    if (Math.hypot(x - cx, y - cy) / stoneRadius <= radiusNorm) n++;
  }
  return n / pixels.length;
}

function regionMeta(pixels, maps) {
  const { width, cx, cy, stoneRadius } = maps;
  let rcx = 0;
  let rcy = 0;
  for (const pi of pixels) {
    rcx += pi % width;
    rcy += (pi / width) | 0;
  }
  rcx /= pixels.length;
  rcy /= pixels.length;
  const distNorm = Math.hypot(rcx - cx, rcy - cy) / stoneRadius;
  const quadrant =
    rcx < cx && rcy < cy
      ? "ul"
      : rcx >= cx && rcy < cy
        ? "ur"
        : rcx < cx && rcy >= cy
          ? "ll"
          : "lr";
  const id = `${quadrant}:${Math.round(rcx)}:${Math.round(rcy)}:${pixels.length}`;
  return {
    id,
    cx: rcx,
    cy: rcy,
    distNorm,
    quadrant,
    centralFraction35: centralFractionAt(pixels, maps, 0.175),
    centralFraction60: centralFractionAt(pixels, maps, 0.3),
    size: pixels.length,
  };
}

function findComponents(maps, pred, cfg) {
  const { width, height, n } = maps;
  const visited = new Uint8Array(n);
  const maxRegionPx = Math.max(
    cfg.maxRegionPx,
    Math.floor(maps.n * cfg.maxRegionFrac),
  );
  const regions = [];

  for (let i = 0; i < n; i++) {
    if (!pred(i) || visited[i]) continue;
    const stack = [i];
    visited[i] = 1;
    const pixels = [];
    let touchesGirdle = false;

    while (stack.length) {
      const pi = stack.pop();
      pixels.push(pi);
      if (maps.edgeDist[pi] < cfg.girdleInsetPx) touchesGirdle = true;
      const x = pi % width;
      const y = (pi / width) | 0;
      for (const ni of neighbors4(pi, x, y, width, height)) {
        if (visited[ni] || !pred(ni)) continue;
        visited[ni] = 1;
        stack.push(ni);
      }
    }

    if (pixels.length < cfg.minRegionPx || pixels.length > maxRegionPx) continue;
    if (touchesGirdle) continue;

    regions.push({ pixels, ...regionMeta(pixels, maps) });
  }

  return regions;
}

function angleInSector(x, y, cx, cy, sector, numSectors) {
  let ang = Math.atan2(y - cy, x - cx);
  if (ang < 0) ang += Math.PI * 2;
  const start = (sector / numSectors) * Math.PI * 2;
  const end = ((sector + 1) / numSectors) * Math.PI * 2;
  return ang >= start && ang < end;
}

/** For step cuts: band by normalized Y within the stone bounds (parallel facets). */
function yBandIndex(y, maps, bands) {
  const t = (y - maps.minY) / Math.max(1, maps.boundsH);
  return Math.min(bands - 1, Math.max(0, Math.floor(t * bands)));
}

function findTrueCentralRegions(maps, cfg, profile) {
  const { width, opaque, lum, cx, cy, stoneRadius } = maps;
  const byId = new Map();
  const sectors = cfg.numCentralSectors;

  for (let sector = 0; sector < sectors; sector++) {
    const regs = findComponents(
      maps,
      (i) => {
        if (!opaque[i]) return false;
        const x = i % width;
        const y = (i / width) | 0;
        if (profile === "step") {
          if (yBandIndex(y, maps, sectors) !== sector) return false;
          const dn = Math.hypot(x - cx, y - cy) / stoneRadius;
          if (dn > cfg.trueCentralPixelRadius) return false;
        } else {
          const dn = Math.hypot(x - cx, y - cy) / stoneRadius;
          if (dn > cfg.trueCentralPixelRadius) return false;
          if (!angleInSector(x, y, cx, cy, sector, sectors)) return false;
        }
        const L = lum[i];
        return L >= cfg.trueCentralLumMin && L <= cfg.trueCentralLumMax;
      },
      cfg,
    );

    for (const r of regs) {
      if (r.size < cfg.minTrueCentralPx) continue;
      if (r.distNorm < cfg.trueCentralCentroidMin) continue;
      if (r.distNorm > cfg.trueCentralCentroidMax) continue;
      if (profile !== "step" && r.centralFraction35 < 0.15 && r.distNorm > 0.14) {
        continue;
      }
      byId.set(r.id, { ...r, trueCentral: true, sector });
    }
  }

  return [...byId.values()].sort((a, b) => a.distNorm - b.distNorm);
}

function findNearCentralRegions(maps, cfg, profile) {
  const { width, opaque, lum, cx, cy, stoneRadius } = maps;
  const byId = new Map();
  const sectors = cfg.numNearCentralSectors;

  for (let sector = 0; sector < sectors; sector++) {
    const regs = findComponents(
      maps,
      (i) => {
        if (!opaque[i]) return false;
        const x = i % width;
        const y = (i / width) | 0;
        if (profile === "step") {
          if (yBandIndex(y, maps, sectors) !== sector) return false;
          const dn = Math.hypot(x - cx, y - cy) / stoneRadius;
          if (dn > cfg.nearCentralPixelRadius) return false;
        } else {
          const dn = Math.hypot(x - cx, y - cy) / stoneRadius;
          if (dn > cfg.nearCentralPixelRadius) return false;
          if (!angleInSector(x, y, cx, cy, sector, sectors)) return false;
        }
        const L = lum[i];
        return L >= cfg.trueCentralLumMin && L <= cfg.trueCentralLumMax;
      },
      cfg,
    );

    for (const r of regs) {
      if (r.size < cfg.minNearCentralPx) continue;
      if (r.distNorm < cfg.nearCentralCentroidMin) continue;
      if (r.distNorm > cfg.nearCentralCentroidMax) continue;
      byId.set(r.id, { ...r, nearCentral: true, sector });
    }
  }

  return [...byId.values()].sort((a, b) => a.distNorm - b.distNorm);
}

function findBrightRegions(maps, cfg) {
  const { opaque, lum } = maps;
  return findComponents(
    maps,
    (i) => {
      if (!opaque[i]) return false;
      const L = lum[i];
      return L >= cfg.brightLumMin && L <= cfg.brightLumMax;
    },
    cfg,
  ).sort((a, b) => b.size - a.size);
}

function findDarkRegions(maps, cfg) {
  const { opaque, lum } = maps;
  return findComponents(
    maps,
    (i) => {
      if (!opaque[i]) return false;
      const L = lum[i];
      return L >= cfg.darkLumMin && L <= cfg.darkLumMax;
    },
    cfg,
  ).sort((a, b) => b.size - a.size);
}

function takeRegions(pool, pred, limit, used, avoid = new Set()) {
  const avoidIds = new Set([...avoid].map((r) => r.id));
  const picked = [];
  const sorted = [...pool].sort((a, b) => b.size - a.size);
  for (const passAvoid of [true, false]) {
    for (const r of sorted) {
      if (used.has(r.id) || !pred(r)) continue;
      if (passAvoid && avoidIds.has(r.id)) continue;
      picked.push(r);
      used.add(r.id);
      if (picked.length >= limit) return picked;
    }
  }
  return picked;
}

function pickOne(pool, pred, used, avoid = new Set()) {
  const avoidIds = new Set([...avoid].map((r) => r.id));
  const sorted = [...pool].sort((a, b) => b.size - a.size);
  for (const passAvoid of [true, false]) {
    for (const r of sorted) {
      if (used.has(r.id) || !pred(r)) continue;
      if (passAvoid && avoidIds.has(r.id)) continue;
      used.add(r.id);
      return r;
    }
  }
  return null;
}

function brilliantPatternSpecs(cfg) {
  return {
    a: {
      centralMode: "strong",
      central: {
        large: (r) =>
          (r.quadrant === "ul" || r.quadrant === "ll") &&
          r.distNorm <= 0.2 &&
          r.size >= cfg.mediumCentralMinPx,
        medium: (r) =>
          r.distNorm <= 0.22 &&
          r.size >= cfg.minTrueCentralPx &&
          r.quadrant !== "lr",
        largeFallback: (r) =>
          r.distNorm <= 0.22 && r.size >= cfg.minTrueCentralPx,
        mediumFallback: (r) => r.distNorm <= 0.24,
      },
      bright: [
        {
          pred: (r) => r.size >= cfg.minBrightMediumPx && r.distNorm > 0.38,
          limit: 2,
        },
        {
          pred: (r) => r.size >= cfg.minBrightSmallPx && r.distNorm > 0.42,
          limit: 2,
        },
      ],
      outerDark: [
        {
          pred: (r) => r.size >= cfg.minOuterDarkMediumPx && r.distNorm > 0.42,
          limit: 2,
        },
        {
          pred: (r) => r.size >= cfg.minOuterDarkSmallPx && r.distNorm > 0.48,
          limit: 2,
        },
      ],
      fallbackBright: (r) =>
        r.distNorm > 0.32 && r.size >= cfg.minBrightSmallPx,
      fallbackOuterDark: (r) =>
        r.distNorm > 0.4 && r.size >= cfg.minOuterDarkSmallPx,
    },
    b: {
      centralMode: "subtle",
      central: {
        medium: (r) =>
          r.quadrant === "ur" &&
          r.distNorm <= 0.2 &&
          r.size >= cfg.minTrueCentralPx,
        mediumFallback: (r) => r.distNorm <= 0.22 && r.quadrant !== "ll",
      },
      bright: [
        {
          pred: (r) => r.size >= cfg.minBrightMediumPx && r.distNorm > 0.4,
          limit: 2,
        },
        {
          pred: (r) => r.size >= cfg.minBrightSmallPx && r.distNorm > 0.44,
          limit: 2,
        },
      ],
      outerDark: [
        {
          pred: (r) => r.size >= cfg.minOuterDarkMediumPx && r.distNorm > 0.45,
          limit: 2,
        },
        {
          pred: (r) => r.size >= cfg.minOuterDarkSmallPx && r.distNorm > 0.5,
          limit: 1,
        },
      ],
      fallbackBright: (r) =>
        r.distNorm > 0.38 && r.size >= cfg.minBrightSmallPx,
      fallbackOuterDark: (r) =>
        r.distNorm > 0.42 && r.size >= cfg.minOuterDarkSmallPx,
    },
    c: {
      centralMode: "strong",
      central: {
        large: (r) =>
          (r.quadrant === "ur" || r.quadrant === "lr") &&
          r.distNorm <= 0.19 &&
          r.size >= cfg.mediumCentralMinPx,
        medium: (r) =>
          r.quadrant === "ll" &&
          r.distNorm <= 0.22 &&
          r.size >= cfg.minTrueCentralPx,
        largeFallback: (r) =>
          r.distNorm <= 0.2 && r.size >= cfg.minTrueCentralPx,
        mediumFallback: (r) => r.distNorm <= 0.24 && r.quadrant !== "ur",
      },
      bright: [
        {
          pred: (r) => r.size >= cfg.minBrightMediumPx && r.distNorm > 0.42,
          limit: 2,
        },
        {
          pred: (r) => r.size >= cfg.minBrightSmallPx && r.distNorm > 0.46,
          limit: 2,
        },
      ],
      outerDark: [
        {
          pred: (r) => r.size >= cfg.minOuterDarkMediumPx && r.distNorm > 0.44,
          limit: 2,
        },
        {
          pred: (r) => r.size >= cfg.minOuterDarkSmallPx && r.distNorm > 0.48,
          limit: 1,
        },
      ],
      fallbackBright: (r) =>
        r.distNorm > 0.4 && r.size >= cfg.minBrightSmallPx,
      fallbackOuterDark: (r) =>
        r.distNorm > 0.42 && r.size >= cfg.minOuterDarkSmallPx,
    },
    d: {
      centralMode: "subtle",
      central: {
        medium: (r) =>
          (r.quadrant === "ul" || r.quadrant === "lr") &&
          r.distNorm <= 0.21 &&
          r.size >= cfg.minTrueCentralPx,
        mediumFallback: (r) => r.distNorm <= 0.23 && r.quadrant !== "ur",
      },
      bright: [
        {
          pred: (r) => r.size >= cfg.minBrightMediumPx && r.distNorm > 0.38,
          limit: 2,
        },
        {
          pred: (r) => r.size >= cfg.minBrightSmallPx && r.distNorm > 0.42,
          limit: 2,
        },
      ],
      outerDark: [
        {
          pred: (r) => r.size >= cfg.minOuterDarkMediumPx && r.distNorm > 0.42,
          limit: 2,
        },
        {
          pred: (r) => r.size >= cfg.minOuterDarkSmallPx && r.distNorm > 0.46,
          limit: 2,
        },
      ],
      fallbackBright: (r) =>
        r.distNorm > 0.32 && r.size >= cfg.minBrightSmallPx,
      fallbackOuterDark: (r) =>
        r.distNorm > 0.4 && r.size >= cfg.minOuterDarkSmallPx,
    },
  };
}

function stepPatternSpecs(cfg, maps) {
  const midY = maps.cy;
  const midX = maps.cx;
  return {
    a: {
      centralMode: "strong",
      central: {
        large: (r) => r.cy < midY && r.size >= cfg.mediumCentralMinPx,
        medium: (r) => r.size >= cfg.minTrueCentralPx,
        largeFallback: (r) => r.size >= cfg.minTrueCentralPx,
        mediumFallback: (r) => r.size >= cfg.minTrueCentralPx * 0.7,
      },
      bright: [
        {
          pred: (r) => r.size >= cfg.minBrightMediumPx && r.distNorm > 0.2,
          limit: 1,
        },
        {
          pred: (r) => r.size >= cfg.minBrightSmallPx && r.distNorm > 0.15,
          limit: 1,
        },
      ],
      outerDark: [
        {
          pred: (r) => r.size >= cfg.minOuterDarkMediumPx && r.distNorm > 0.22,
          limit: 1,
        },
        {
          pred: (r) => r.size >= cfg.minOuterDarkSmallPx && r.distNorm > 0.18,
          limit: 1,
        },
      ],
      fallbackBright: (r) => r.size >= cfg.minBrightSmallPx,
      fallbackOuterDark: (r) => r.size >= cfg.minOuterDarkSmallPx,
    },
    b: {
      centralMode: "subtle",
      central: {
        medium: (r) => r.cy >= midY && r.size >= cfg.minTrueCentralPx,
        mediumFallback: (r) => r.size >= cfg.minTrueCentralPx * 0.7,
      },
      bright: [
        {
          pred: (r) =>
            r.size >= cfg.minBrightMediumPx && r.quadrant.startsWith("u"),
          limit: 1,
        },
        {
          pred: (r) => r.size >= cfg.minBrightSmallPx,
          limit: 1,
        },
      ],
      outerDark: [
        {
          pred: (r) =>
            r.size >= cfg.minOuterDarkMediumPx && r.quadrant.startsWith("l"),
          limit: 1,
        },
        {
          pred: (r) => r.size >= cfg.minOuterDarkSmallPx,
          limit: 1,
        },
      ],
      fallbackBright: (r) => r.size >= cfg.minBrightSmallPx,
      fallbackOuterDark: (r) => r.size >= cfg.minOuterDarkSmallPx,
    },
    c: {
      centralMode: "strong",
      central: {
        large: (r) => r.quadrant === "ur" || r.quadrant === "lr",
        medium: (r) => r.quadrant === "ul" || r.quadrant === "ll",
        largeFallback: (r) => r.size >= cfg.minTrueCentralPx,
        mediumFallback: (r) => r.size >= cfg.minTrueCentralPx * 0.7,
      },
      bright: [
        {
          pred: (r) => r.size >= cfg.minBrightMediumPx && r.cx > midX,
          limit: 1,
        },
        {
          pred: (r) => r.size >= cfg.minBrightSmallPx,
          limit: 1,
        },
      ],
      outerDark: [
        {
          pred: (r) => r.size >= cfg.minOuterDarkMediumPx && r.cx <= midX,
          limit: 1,
        },
        {
          pred: (r) => r.size >= cfg.minOuterDarkSmallPx,
          limit: 1,
        },
      ],
      fallbackBright: (r) => r.size >= cfg.minBrightSmallPx,
      fallbackOuterDark: (r) => r.size >= cfg.minOuterDarkSmallPx,
    },
    d: {
      centralMode: "subtle",
      central: {
        medium: (r) => r.quadrant === "ul" || r.quadrant === "lr",
        mediumFallback: (r) => r.size >= cfg.minTrueCentralPx * 0.6,
      },
      bright: [
        {
          pred: (r) => r.size >= cfg.minBrightMediumPx && r.distNorm > 0.18,
          limit: 1,
        },
        {
          pred: (r) => r.size >= cfg.minBrightSmallPx,
          limit: 1,
        },
      ],
      outerDark: [
        {
          pred: (r) => r.size >= cfg.minOuterDarkMediumPx && r.distNorm > 0.2,
          limit: 1,
        },
        {
          pred: (r) => r.size >= cfg.minOuterDarkSmallPx,
          limit: 1,
        },
      ],
      fallbackBright: (r) => r.size >= cfg.minBrightSmallPx,
      fallbackOuterDark: (r) => r.size >= cfg.minOuterDarkSmallPx,
    },
  };
}

function expandInfluence(mask, maps, radius) {
  const { width, height, opaque, n } = maps;
  if (radius < 1) return mask;
  const out = new Float32Array(n);
  const r2 = radius * radius;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!opaque[i]) continue;
      let peak = mask[i];
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > r2) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (!opaque[ni]) continue;
          peak = Math.max(peak, mask[ni]);
        }
      }
      out[i] = peak;
    }
  }
  return out;
}

function buildInfluenceMask(maps, regions, expandRadius, featherRadius) {
  const { width, height, n } = maps;
  const raw = new Float32Array(n);
  for (const r of regions) {
    for (const pi of r.pixels) raw[pi] = 1;
  }
  const expanded = expandInfluence(raw, maps, expandRadius);
  return boxBlur(expanded, width, height, featherRadius);
}

function measureMaskFrac(maps, mask) {
  let px = 0;
  for (let i = 0; i < maps.n; i++) {
    if (!maps.opaque[i]) continue;
    if (mask[i] > 0.004) px++;
  }
  return px / maps.stonePx;
}

function measureCoverage(maps, brightRegions, centralDarkRegions, outerDarkRegions, cfg) {
  const brightMask = buildInfluenceMask(
    maps,
    brightRegions,
    cfg.regionExpandRadius,
    cfg.featherRadius,
  );
  const centralMask = buildInfluenceMask(
    maps,
    centralDarkRegions,
    cfg.centralExpandRadius,
    cfg.featherRadius,
  );
  const outerMask = buildInfluenceMask(
    maps,
    outerDarkRegions,
    cfg.regionExpandRadius,
    cfg.featherRadius,
  );
  let totalPx = 0;
  for (let i = 0; i < maps.n; i++) {
    if (!maps.opaque[i]) continue;
    if (
      brightMask[i] > 0.004 ||
      centralMask[i] > 0.004 ||
      outerMask[i] > 0.004
    ) {
      totalPx++;
    }
  }
  return {
    brightFrac: measureMaskFrac(maps, brightMask),
    centralDarkFrac: measureMaskFrac(maps, centralMask),
    outerDarkFrac: measureMaskFrac(maps, outerMask),
    totalFrac: totalPx / maps.stonePx,
    brightMask,
    centralMask,
    outerMask,
  };
}

function regionOverlap(regionsA, regionsB) {
  if (!regionsA.length || !regionsB.length) return 0;
  const setB = new Set(regionsB);
  let shared = 0;
  for (const r of regionsA) if (setB.has(r)) shared++;
  return shared / regionsA.length;
}

function pixelOverlap(regionsA, regionsB) {
  const setA = new Set();
  for (const r of regionsA) for (const pi of r.pixels) setA.add(pi);
  let shared = 0;
  let total = 0;
  for (const r of regionsB) {
    for (const pi of r.pixels) {
      total++;
      if (setA.has(pi)) shared++;
    }
  }
  return total ? shared / total : 0;
}

function renderVariant(maps, brightRegions, centralDarkRegions, outerDarkRegions, cfg) {
  const coverage = measureCoverage(
    maps,
    brightRegions,
    centralDarkRegions,
    outerDarkRegions,
    cfg,
  );
  const { width, height, data, n } = maps;
  const { brightMask, centralMask, outerMask } = coverage;
  const out = new PNG({ width, height });

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const a = data[o + 3];
    out.data[o + 3] = a;
    if (a < OPAQUE_ALPHA) continue;

    let r = data[o];
    let g = data[o + 1];
    let b = data[o + 2];
    const bw = brightMask[i];
    const cdw = centralMask[i];
    const odw = outerMask[i];

    if (bw > 0.004) {
      r = clampByte(r + cfg.brightLift * bw);
      g = clampByte(g + cfg.brightLift * bw);
      b = clampByte(b + cfg.brightLift * bw);
      if (r > 254) r = 254;
      if (g > 254) g = 254;
      if (b > 254) b = 254;
    } else if (cdw > 0.004) {
      const m = 1 - cdw * (1 - cfg.centralDarkMult);
      r = clampByte(r * m);
      g = clampByte(g * m);
      b = clampByte(b * m);
    } else if (odw > 0.004) {
      const m = 1 - odw * (1 - cfg.smallDarkMult);
      r = clampByte(r * m);
      g = clampByte(g * m);
      b = clampByte(b * m);
    }

    out.data[o] = r;
    out.data[o + 1] = g;
    out.data[o + 2] = b;
  }

  return { png: out, coverage };
}

function measureChangedCentral(maps, baseData, variantData) {
  const { width, cx, cy, stoneRadius, n } = maps;
  let changed = 0;
  let c60 = 0;
  let c35 = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (baseData[o + 3] < OPAQUE_ALPHA) continue;
    const dr = variantData[o] - baseData[o];
    const dg = variantData[o + 1] - baseData[o + 1];
    const db = variantData[o + 2] - baseData[o + 2];
    const mag = (Math.abs(dr) + Math.abs(dg) + Math.abs(db)) / 3;
    if (mag < 1) continue;
    changed++;
    const dn =
      Math.hypot((i % width) - cx, ((i / width) | 0) - cy) / stoneRadius;
    if (dn <= 0.3) c60++;
    if (dn <= 0.175) c35++;
  }
  return {
    changedPercentCentral60: changed ? (c60 / changed) * 100 : 0,
    changedPercentCentral35: changed ? (c35 / changed) * 100 : 0,
    changedCount: changed,
    changedFrac: changed / maps.stonePx,
  };
}

function pickCentralRegions(spec, trueCentralPool, nearCentralPool, used, avoidCentral, cfg) {
  const central = [];
  const pool = trueCentralPool.filter(
    (r) => r.distNorm <= cfg.trueCentralCentroidMax,
  );

  if (spec.centralMode === "subtle") {
    const medium =
      pickOne(pool, spec.central.medium, used, avoidCentral) ??
      pickOne(pool, spec.central.mediumFallback, used, avoidCentral);
    if (medium) central.push({ ...medium, role: "medium" });

    if (nearCentralPool.length) {
      const near = pickOne(
        nearCentralPool,
        (r) =>
          r.distNorm >= cfg.nearCentralCentroidMin &&
          r.distNorm <= cfg.nearCentralCentroidMax,
        used,
        avoidCentral,
      );
      if (near) central.push({ ...near, role: "near" });
    }
    return central;
  }

  let large =
    pickOne(pool, spec.central.large, used, avoidCentral) ??
    pickOne(pool, spec.central.largeFallback, used, avoidCentral);
  if (large) central.push({ ...large, role: "large" });

  if (spec.central.medium) {
    const medium =
      pickOne(pool, spec.central.medium, used, avoidCentral) ??
      (spec.central.mediumFallback
        ? pickOne(pool, spec.central.mediumFallback, used, avoidCentral)
        : null);
    if (medium && medium.id !== large?.id) {
      central.push({ ...medium, role: "medium" });
    }
  }

  return central;
}

function pickPatternRegions(
  maps,
  spec,
  brightPool,
  darkPool,
  trueCentralPool,
  nearCentralPool,
  avoidCentral,
  avoidBright,
  avoidOuterDark,
  cfg,
) {
  const used = new Set();
  let centralDark = pickCentralRegions(
    spec,
    trueCentralPool,
    nearCentralPool,
    used,
    avoidCentral,
    cfg,
  );
  for (const r of centralDark) used.add(r.id);

  const brightUse = [];
  const outerDarkUse = [];

  for (const step of spec.bright) {
    brightUse.push(
      ...takeRegions(brightPool, step.pred, step.limit ?? 2, used, avoidBright),
    );
  }
  for (const step of spec.outerDark) {
    outerDarkUse.push(
      ...takeRegions(
        darkPool,
        (r) => step.pred(r) && !used.has(r.id),
        step.limit ?? 2,
        used,
        avoidOuterDark,
      ),
    );
  }

  while (brightUse.length < cfg.minBrightPerPattern) {
    const next = brightPool.find(
      (r) =>
        !used.has(r.id) &&
        spec.fallbackBright(r) &&
        !avoidBright.some((a) => a.id === r.id),
    );
    if (!next) break;
    brightUse.push(next);
    used.add(next.id);
  }
  while (outerDarkUse.length < cfg.minOuterDarkPerPattern) {
    const next = darkPool.find(
      (r) =>
        !used.has(r.id) &&
        spec.fallbackOuterDark(r) &&
        !avoidOuterDark.some((a) => a.id === r.id),
    );
    if (!next) break;
    outerDarkUse.push(next);
    used.add(next.id);
  }

  const brightFinal = brightUse.slice(0, cfg.maxBrightPerPattern);
  let outerDarkFinal = outerDarkUse.slice(0, cfg.maxOuterDarkPerPattern);

  let growGuard = 0;
  while (growGuard++ < 36) {
    const { totalFrac } = measureCoverage(
      maps,
      brightFinal,
      centralDark,
      outerDarkFinal,
      cfg,
    );
    if (totalFrac >= cfg.targetAreaMin && totalFrac <= cfg.targetAreaMax) break;
    if (totalFrac >= cfg.targetAreaMax) break;

    const addBright = brightFinal.length <= outerDarkFinal.length;
    const pool = addBright ? brightPool : darkPool;
    const list = addBright ? brightFinal : outerDarkFinal;
    const avoid = addBright ? avoidBright : avoidOuterDark;
    const max = addBright ? cfg.maxBrightPerPattern : cfg.maxOuterDarkPerPattern;
    if (list.length >= max) {
      if (addBright && outerDarkFinal.length < cfg.maxOuterDarkPerPattern) continue;
      if (!addBright && brightFinal.length < cfg.maxBrightPerPattern) continue;
      break;
    }
    const next = pool.find(
      (r) =>
        !used.has(r.id) &&
        !list.some((x) => x.id === r.id) &&
        !avoid.some((a) => a.id === r.id) &&
        (addBright
          ? r.size >= cfg.minBrightSmallPx
          : r.size >= cfg.minOuterDarkSmallPx),
    );
    if (!next) break;
    list.push(next);
    used.add(next.id);
  }

  if (centralDark.length === 0 && trueCentralPool.length) {
    const fallback = pickOne(trueCentralPool, () => true, used, avoidCentral);
    if (fallback) centralDark = [{ ...fallback, role: "large" }];
  }

  // Final safety: if region pools are thin, seed with largest available pixels.
  if (
    brightFinal.length === 0 &&
    outerDarkFinal.length === 0 &&
    centralDark.length === 0
  ) {
    if (brightPool[0]) brightFinal.push(brightPool[0]);
    if (darkPool[0]) {
      centralDark = [{ ...darkPool[0], role: "large" }];
    }
  }

  return { brightFinal, centralDark, outerDarkFinal };
}

function regionSummary(regions, cfg) {
  return regions.map((r) => ({
    id: r.id,
    role: r.role ?? "outer",
    sizeTier: sizeTier(r.size, cfg),
    pixels: r.size,
    quadrant: r.quadrant,
    distNorm: Number(r.distNorm.toFixed(3)),
    centralFraction35: Number((r.centralFraction35 ?? 0).toFixed(3)),
  }));
}

/**
 * Generate four scintillation variants for a CAD base PNG.
 * @returns {Promise<object>} manifest for this shape
 */
export function generateScintillationVariants({
  shapeId,
  profile,
  sourcePath,
  outDir,
  variantPrefix,
}) {
  const cfg = cfgFor(profile);
  const src = loadPng(sourcePath);
  const maps = buildStoneMaps(src);
  const brightPool = findBrightRegions(maps, cfg);
  const darkPool = findDarkRegions(maps, cfg);
  const trueCentralPool = findTrueCentralRegions(maps, cfg, profile);
  const nearCentralPool = findNearCentralRegions(maps, cfg, profile);
  const specs =
    profile === "step"
      ? stepPatternSpecs(cfg, maps)
      : brilliantPatternSpecs(cfg);

  const assigned = {};
  const usedCentralIds = new Set();
  let prevBright = [];
  let prevOuterDark = [];

  const manifest = {
    shapeId,
    profile,
    source: path.relative(path.resolve(outDir, "../.."), sourcePath).replace(/\\/g, "/"),
    canvas: `${maps.width}x${maps.height}`,
    alphaPreserved: true,
    brightLuminanceRange: [cfg.brightLumMin, cfg.brightLumMax],
    darkLuminanceRange: [cfg.darkLumMin, cfg.darkLumMax],
    trueCentralLuminanceRange: [cfg.trueCentralLumMin, cfg.trueCentralLumMax],
    trueCentralCentroidRange: [
      cfg.trueCentralCentroidMin,
      cfg.trueCentralCentroidMax,
    ],
    trueCentralPixelRadius: cfg.trueCentralPixelRadius,
    brightLiftRgb: cfg.brightLift,
    outerDarkLuminanceMultiplier: cfg.smallDarkMult,
    trueCentralDarkLuminanceMultiplier: cfg.centralDarkMult,
    regionExpandRadiusPx: cfg.regionExpandRadius,
    centralRegionExpandRadiusPx: cfg.centralExpandRadius,
    girdleInsetPx: cfg.girdleInsetPx,
    featherRadiusPx: cfg.featherRadius,
    brightRegionPool: brightPool.length,
    darkRegionPool: darkPool.length,
    trueCentralRegionPool: trueCentralPool.length,
    nearCentralRegionPool: nearCentralPool.length,
    patterns: {},
    consecutiveOverlap: {},
  };

  for (const key of PATTERN_KEYS) {
    const avoidCentral = [
      ...trueCentralPool.filter((r) => usedCentralIds.has(r.id)),
      ...nearCentralPool.filter((r) => usedCentralIds.has(r.id)),
    ];
    const patternIndex = PATTERN_KEYS.indexOf(key);
    const rotatedBright = [
      ...brightPool.slice(patternIndex * 4),
      ...brightPool.slice(0, patternIndex * 4),
    ];
    const rotatedDark = [
      ...darkPool.slice(patternIndex * 3),
      ...darkPool.slice(0, patternIndex * 3),
    ];
    const { brightFinal, centralDark, outerDarkFinal } = pickPatternRegions(
      maps,
      specs[key],
      rotatedBright,
      rotatedDark,
      trueCentralPool,
      nearCentralPool,
      avoidCentral,
      prevBright,
      prevOuterDark,
      cfg,
    );

    const { png, coverage } = renderVariant(
      maps,
      brightFinal,
      centralDark,
      outerDarkFinal,
      cfg,
    );

    const centralStats = measureChangedCentral(maps, maps.data, png.data);
    const fileName = `${variantPrefix}-${key}.png`;
    writePng(path.join(outDir, fileName), png);
    assigned[key] = { brightFinal, centralDark, outerDarkFinal };

    // Ensure variant differs from base: if no change, force a subtle mid-tone shift.
    if (centralStats.changedCount < Math.max(40, Math.floor(maps.stonePx * 0.002))) {
      for (let i = 0; i < maps.n; i++) {
        if (!maps.opaque[i]) continue;
        const o = i * 4;
        const L = maps.lum[i];
        if (L < 110 || L > 190) continue;
        const x = i % maps.width;
        const y = (i / maps.width) | 0;
        const band = ((x + y + PATTERN_KEYS.indexOf(key) * 37) % 97) < 28;
        if (!band) continue;
        const mult = key === "a" || key === "c" ? 0.92 : 1.06;
        png.data[o] = clampByte(png.data[o] * mult);
        png.data[o + 1] = clampByte(png.data[o + 1] * mult);
        png.data[o + 2] = clampByte(png.data[o + 2] * mult);
      }
      writePng(path.join(outDir, fileName), png);
    }

    manifest.patterns[key] = {
      file: publicDiamondPath(fileName),
      centralMode: specs[key].centralMode,
      brightRegions: brightFinal.length,
      trueCentralRegions: centralDark.length,
      outerDarkRegions: outerDarkFinal.length,
      regionTiers: {
        bright: tierCounts(brightFinal, cfg),
        trueCentral: tierCounts(centralDark, cfg),
        outerDark: tierCounts(outerDarkFinal, cfg),
      },
      coverage: {
        brightPercent: Number((coverage.brightFrac * 100).toFixed(2)),
        trueCentralPercent: Number((coverage.centralDarkFrac * 100).toFixed(2)),
        outerDarkPercent: Number((coverage.outerDarkFrac * 100).toFixed(2)),
        totalPercent: Number((coverage.totalFrac * 100).toFixed(2)),
        changedPercentCentral60Diameter: Number(
          centralStats.changedPercentCentral60.toFixed(2),
        ),
        changedPercentCentral35Diameter: Number(
          centralStats.changedPercentCentral35.toFixed(2),
        ),
        changedOpaquePercent: Number((centralStats.changedFrac * 100).toFixed(2)),
      },
      bright: regionSummary(brightFinal, cfg),
      trueCentral: regionSummary(centralDark, cfg),
      outerDark: regionSummary(outerDarkFinal, cfg),
    };

    for (const r of centralDark) usedCentralIds.add(r.id);
    prevBright = brightFinal;
    prevOuterDark = outerDarkFinal;
  }

  for (let i = 1; i < PATTERN_KEYS.length; i++) {
    const prev = PATTERN_KEYS[i - 1];
    const curr = PATTERN_KEYS[i];
    const prevA = assigned[prev];
    const currA = assigned[curr];
    manifest.consecutiveOverlap[`${prev}-${curr}`] = {
      brightRegionOverlapPercent: Number(
        (regionOverlap(prevA.brightFinal, currA.brightFinal) * 100).toFixed(1),
      ),
      brightPixelOverlapPercent: Number(
        (pixelOverlap(prevA.brightFinal, currA.brightFinal) * 100).toFixed(1),
      ),
      trueCentralRegionOverlapPercent: Number(
        (regionOverlap(prevA.centralDark, currA.centralDark) * 100).toFixed(1),
      ),
      trueCentralPixelOverlapPercent: Number(
        (pixelOverlap(prevA.centralDark, currA.centralDark) * 100).toFixed(1),
      ),
      outerDarkRegionOverlapPercent: Number(
        (regionOverlap(prevA.outerDarkFinal, currA.outerDarkFinal) * 100).toFixed(
          1,
        ),
      ),
      outerDarkPixelOverlapPercent: Number(
        (pixelOverlap(prevA.outerDarkFinal, currA.outerDarkFinal) * 100).toFixed(
          1,
        ),
      ),
    };
  }

  return manifest;
}

export { PATTERN_KEYS, BRILLIANT, STEP };
