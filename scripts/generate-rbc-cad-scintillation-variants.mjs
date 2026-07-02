/**
 * Generate contrast-shift scintillation variants from the Round CAD base PNG.
 *
 *   node scripts/generate-rbc-cad-scintillation-variants.mjs
 *   node scripts/generate-rbc-cad-scintillation-variants.mjs --source=rbc-cad.png
 */
import fs from "fs";
import path from "path";
import { PNG } from "pngjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public/diamond-tech-suite/diamonds");
const SRC_ARG = process.argv.find((a) => a.startsWith("--source="));
const SRC_NAME = SRC_ARG ? SRC_ARG.split("=")[1] : "rbc-cad-pop.png";
const SRC = path.join(OUT_DIR, SRC_NAME);

const BRIGHT_LUM_MIN = 225;
const BRIGHT_LUM_MAX = 254;
const DARK_LUM_MIN = 70;
const DARK_LUM_MAX = 205;
const TRUE_CENTRAL_LUM_MIN = 85;
const TRUE_CENTRAL_LUM_MAX = 215;
const TRUE_CENTRAL_PIXEL_RADIUS = 0.225;
const TRUE_CENTRAL_CENTROID_MIN = 0.05;
const TRUE_CENTRAL_CENTROID_MAX = 0.24;
const MIN_REGION_PX = 50;
const MIN_TRUE_CENTRAL_PX = 200;
const MIN_NEAR_CENTRAL_PX = 350;
const NEAR_CENTRAL_CENTROID_MIN = 0.22;
const NEAR_CENTRAL_CENTROID_MAX = 0.34;
const NEAR_CENTRAL_PIXEL_RADIUS = 0.35;
const MIN_BRIGHT_MEDIUM_PX = 550;
const MIN_BRIGHT_SMALL_PX = 280;
const MIN_OUTER_DARK_MEDIUM_PX = 450;
const MIN_OUTER_DARK_SMALL_PX = 320;
const LARGE_CENTRAL_MIN_PX = 600;
const MEDIUM_CENTRAL_MIN_PX = 350;
const MAX_REGION_PX = 4500;
const MAX_REGION_FRAC = 0.0008;
const GIRDLE_INSET_PX = 6;
const FEATHER_RADIUS = 1;
const REGION_EXPAND_RADIUS = 10;
const CENTRAL_EXPAND_RADIUS = 12;
const MAX_BRIGHT_PER_PATTERN = 6;
const MIN_BRIGHT_PER_PATTERN = 3;
const MAX_OUTER_DARK_PER_PATTERN = 5;
const MIN_OUTER_DARK_PER_PATTERN = 2;
const TARGET_AREA_MIN = 0.04;
const TARGET_AREA_MAX = 0.055;
const BRIGHT_LIFT = 15;
const SMALL_DARK_MULT = 0.83;
const CENTRAL_DARK_MULT = 0.86;
const NUM_CENTRAL_SECTORS = 16;
const NUM_NEAR_CENTRAL_SECTORS = 8;

const MANIFEST_PATH = path.join(
  OUT_DIR,
  "rbc-cad-scintillation-variants.json",
);

function sizeTier(size) {
  if (size >= LARGE_CENTRAL_MIN_PX) return "large";
  if (size >= MEDIUM_CENTRAL_MIN_PX) return "medium";
  return "small";
}

function tierCounts(regions) {
  const counts = { small: 0, medium: 0, large: 0 };
  for (const r of regions) counts[sizeTier(r.size)]++;
  return counts;
}

function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function loadPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function writePng(filePath, png) {
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

function buildStoneMaps(png) {
  const { width, height, data } = png;
  const n = width * height;
  const opaque = new Uint8Array(n);
  const lum = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (data[o + 3] < 12) continue;
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
  for (let i = 0; i < n; i++) {
    if (!opaque[i]) continue;
    cx += i % width;
    cy += (i / width) | 0;
    stonePx++;
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
  };
}

function neighbors4(i, x, y, width, height) {
  const out = [];
  if (x > 0) out.push(i - 1);
  if (x < width - 1) out.push(i + 1);
  if (y > 0) out.push(i - width);
  if (y < height - 1) out.push(i + width);
  return out;
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

function findComponents(maps, pred) {
  const { width, height, n } = maps;
  const visited = new Uint8Array(n);
  const maxRegionPx = Math.max(
    MAX_REGION_PX,
    Math.floor(maps.n * MAX_REGION_FRAC),
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
      if (maps.edgeDist[pi] < GIRDLE_INSET_PX) touchesGirdle = true;
      const x = pi % width;
      const y = (pi / width) | 0;
      for (const ni of neighbors4(pi, x, y, width, height)) {
        if (visited[ni] || !pred(ni)) continue;
        visited[ni] = 1;
        stack.push(ni);
      }
    }

    if (pixels.length < MIN_REGION_PX || pixels.length > maxRegionPx) continue;
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

function findTrueCentralRegions(maps) {
  const { width, opaque, lum, cx, cy, stoneRadius } = maps;
  const byId = new Map();

  for (let sector = 0; sector < NUM_CENTRAL_SECTORS; sector++) {
    const regs = findComponents(maps, (i) => {
      if (!opaque[i]) return false;
      const x = i % width;
      const y = (i / width) | 0;
      const dn = Math.hypot(x - cx, y - cy) / stoneRadius;
      if (dn > TRUE_CENTRAL_PIXEL_RADIUS) return false;
      const L = lum[i];
      if (L < TRUE_CENTRAL_LUM_MIN || L > TRUE_CENTRAL_LUM_MAX) return false;
      return angleInSector(x, y, cx, cy, sector, NUM_CENTRAL_SECTORS);
    });

    for (const r of regs) {
      if (r.size < MIN_TRUE_CENTRAL_PX) continue;
      if (r.distNorm < TRUE_CENTRAL_CENTROID_MIN) continue;
      if (r.distNorm > TRUE_CENTRAL_CENTROID_MAX) continue;
      if (r.centralFraction35 < 0.15 && r.distNorm > 0.14) continue;
      byId.set(r.id, { ...r, trueCentral: true, sector });
    }
  }

  return [...byId.values()].sort((a, b) => a.distNorm - b.distNorm);
}

function findNearCentralRegions(maps) {
  const { width, opaque, lum, cx, cy, stoneRadius } = maps;
  const byId = new Map();

  for (let sector = 0; sector < NUM_NEAR_CENTRAL_SECTORS; sector++) {
    const regs = findComponents(maps, (i) => {
      if (!opaque[i]) return false;
      const x = i % width;
      const y = (i / width) | 0;
      const dn = Math.hypot(x - cx, y - cy) / stoneRadius;
      if (dn > NEAR_CENTRAL_PIXEL_RADIUS) return false;
      const L = lum[i];
      if (L < TRUE_CENTRAL_LUM_MIN || L > TRUE_CENTRAL_LUM_MAX) return false;
      return angleInSector(x, y, cx, cy, sector, NUM_NEAR_CENTRAL_SECTORS);
    });

    for (const r of regs) {
      if (r.size < MIN_NEAR_CENTRAL_PX) continue;
      if (r.distNorm < NEAR_CENTRAL_CENTROID_MIN) continue;
      if (r.distNorm > NEAR_CENTRAL_CENTROID_MAX) continue;
      byId.set(r.id, { ...r, nearCentral: true, sector });
    }
  }

  return [...byId.values()].sort((a, b) => a.distNorm - b.distNorm);
}

function findBrightRegions(maps) {
  const { opaque, lum } = maps;
  return findComponents(maps, (i) => {
    if (!opaque[i]) return false;
    const L = lum[i];
    return L >= BRIGHT_LUM_MIN && L <= BRIGHT_LUM_MAX;
  }).sort((a, b) => b.size - a.size);
}

function findDarkRegions(maps) {
  const { opaque, lum } = maps;
  return findComponents(maps, (i) => {
    if (!opaque[i]) return false;
    const L = lum[i];
    return L >= DARK_LUM_MIN && L <= DARK_LUM_MAX;
  }).sort((a, b) => b.size - a.size);
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

const PATTERN_SPECS = {
  a: {
    centralMode: "strong",
    central: {
      large: (r) =>
        (r.quadrant === "ul" || r.quadrant === "ll") &&
        r.distNorm <= 0.2 &&
        r.size >= MEDIUM_CENTRAL_MIN_PX,
      medium: (r) =>
        r.distNorm <= 0.22 &&
        r.size >= MIN_TRUE_CENTRAL_PX &&
        r.quadrant !== "lr",
      largeFallback: (r) => r.distNorm <= 0.22 && r.size >= MIN_TRUE_CENTRAL_PX,
      mediumFallback: (r) => r.distNorm <= 0.24,
    },
    bright: [
      { pred: (r) => r.size >= MIN_BRIGHT_MEDIUM_PX && r.distNorm > 0.38, limit: 2 },
      { pred: (r) => r.size >= MIN_BRIGHT_SMALL_PX && r.distNorm > 0.42, limit: 2 },
    ],
    outerDark: [
      { pred: (r) => r.size >= MIN_OUTER_DARK_MEDIUM_PX && r.distNorm > 0.42, limit: 2 },
      { pred: (r) => r.size >= MIN_OUTER_DARK_SMALL_PX && r.distNorm > 0.48, limit: 2 },
    ],
    fallbackBright: (r) => r.distNorm > 0.32 && r.size >= MIN_BRIGHT_SMALL_PX,
    fallbackOuterDark: (r) => r.distNorm > 0.4 && r.size >= MIN_OUTER_DARK_SMALL_PX,
  },
  b: {
    centralMode: "subtle",
    central: {
      medium: (r) =>
        r.quadrant === "ur" &&
        r.distNorm <= 0.2 &&
        r.size >= MIN_TRUE_CENTRAL_PX,
      mediumFallback: (r) => r.distNorm <= 0.22 && r.quadrant !== "ll",
    },
    bright: [
      { pred: (r) => r.size >= MIN_BRIGHT_MEDIUM_PX && r.distNorm > 0.4, limit: 2 },
      { pred: (r) => r.size >= MIN_BRIGHT_SMALL_PX && r.distNorm > 0.44, limit: 2 },
    ],
    outerDark: [
      { pred: (r) => r.size >= MIN_OUTER_DARK_MEDIUM_PX && r.distNorm > 0.45, limit: 2 },
      { pred: (r) => r.size >= MIN_OUTER_DARK_SMALL_PX && r.distNorm > 0.5, limit: 1 },
    ],
    fallbackBright: (r) => r.distNorm > 0.38 && r.size >= MIN_BRIGHT_SMALL_PX,
    fallbackOuterDark: (r) => r.distNorm > 0.42 && r.size >= MIN_OUTER_DARK_SMALL_PX,
  },
  c: {
    centralMode: "strong",
    central: {
      large: (r) =>
        (r.quadrant === "ur" || r.quadrant === "lr") &&
        r.distNorm <= 0.19 &&
        r.size >= MEDIUM_CENTRAL_MIN_PX,
      medium: (r) =>
        r.quadrant === "ll" &&
        r.distNorm <= 0.22 &&
        r.size >= MIN_TRUE_CENTRAL_PX,
      largeFallback: (r) => r.distNorm <= 0.2 && r.size >= MIN_TRUE_CENTRAL_PX,
      mediumFallback: (r) => r.distNorm <= 0.24 && r.quadrant !== "ur",
    },
    bright: [
      { pred: (r) => r.size >= MIN_BRIGHT_MEDIUM_PX && r.distNorm > 0.42, limit: 2 },
      { pred: (r) => r.size >= MIN_BRIGHT_SMALL_PX && r.distNorm > 0.46, limit: 2 },
    ],
    outerDark: [
      { pred: (r) => r.size >= MIN_OUTER_DARK_MEDIUM_PX && r.distNorm > 0.44, limit: 2 },
      { pred: (r) => r.size >= MIN_OUTER_DARK_SMALL_PX && r.distNorm > 0.48, limit: 1 },
    ],
    fallbackBright: (r) => r.distNorm > 0.4 && r.size >= MIN_BRIGHT_SMALL_PX,
    fallbackOuterDark: (r) => r.distNorm > 0.42 && r.size >= MIN_OUTER_DARK_SMALL_PX,
  },
  d: {
    centralMode: "subtle",
    central: {
      medium: (r) =>
        (r.quadrant === "ul" || r.quadrant === "lr") &&
        r.distNorm <= 0.21 &&
        r.size >= MIN_TRUE_CENTRAL_PX,
      mediumFallback: (r) => r.distNorm <= 0.23 && r.quadrant !== "ur",
    },
    bright: [
      { pred: (r) => r.size >= MIN_BRIGHT_MEDIUM_PX && r.distNorm > 0.38, limit: 2 },
      { pred: (r) => r.size >= MIN_BRIGHT_SMALL_PX && r.distNorm > 0.42, limit: 2 },
    ],
    outerDark: [
      { pred: (r) => r.size >= MIN_OUTER_DARK_MEDIUM_PX && r.distNorm > 0.42, limit: 2 },
      { pred: (r) => r.size >= MIN_OUTER_DARK_SMALL_PX && r.distNorm > 0.46, limit: 2 },
    ],
    fallbackBright: (r) => r.distNorm > 0.32 && r.size >= MIN_BRIGHT_SMALL_PX,
    fallbackOuterDark: (r) => r.distNorm > 0.4 && r.size >= MIN_OUTER_DARK_SMALL_PX,
  },
};

function boxBlur(mask, width, height, radius) {
  if (radius < 1) return mask;
  const tmp = new Float32Array(mask.length);
  const out = new Float32Array(mask.length);
  const r = radius | 0;
  const div = r * 2 + 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) {
        sum += mask[y * width + Math.min(width - 1, Math.max(0, x + k))];
      }
      tmp[y * width + x] = sum / div;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) {
        sum += tmp[Math.min(height - 1, Math.max(0, y + k)) * width + x];
      }
      out[y * width + x] = sum / div;
    }
  }
  return out;
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

function buildInfluenceMask(maps, regions, expandRadius = REGION_EXPAND_RADIUS) {
  const { width, height, n } = maps;
  const raw = new Float32Array(n);
  for (const r of regions) {
    for (const pi of r.pixels) raw[pi] = 1;
  }
  const expanded = expandInfluence(raw, maps, expandRadius);
  return boxBlur(expanded, width, height, FEATHER_RADIUS);
}

function measureMaskFrac(maps, mask) {
  let px = 0;
  for (let i = 0; i < maps.n; i++) {
    if (!maps.opaque[i]) continue;
    if (mask[i] > 0.004) px++;
  }
  return px / maps.stonePx;
}

function measureCoverage(maps, brightRegions, centralDarkRegions, outerDarkRegions) {
  const brightMask = buildInfluenceMask(maps, brightRegions);
  const centralMask = buildInfluenceMask(
    maps,
    centralDarkRegions,
    CENTRAL_EXPAND_RADIUS,
  );
  const outerMask = buildInfluenceMask(maps, outerDarkRegions);
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

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function renderVariant(maps, brightRegions, centralDarkRegions, outerDarkRegions) {
  const coverage = measureCoverage(
    maps,
    brightRegions,
    centralDarkRegions,
    outerDarkRegions,
  );
  const { width, height, data, n } = maps;
  const { brightMask, centralMask, outerMask } = coverage;
  const out = new PNG({ width, height });

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const a = data[o + 3];
    out.data[o + 3] = a;
    if (a < 12) continue;

    let r = data[o];
    let g = data[o + 1];
    let b = data[o + 2];
    const bw = brightMask[i];
    const cdw = centralMask[i];
    const odw = outerMask[i];

    if (bw > 0.004) {
      r = clampByte(r + BRIGHT_LIFT * bw);
      g = clampByte(g + BRIGHT_LIFT * bw);
      b = clampByte(b + BRIGHT_LIFT * bw);
      if (r > 254) r = 254;
      if (g > 254) g = 254;
      if (b > 254) b = 254;
    } else if (cdw > 0.004) {
      const m = 1 - cdw * (1 - CENTRAL_DARK_MULT);
      r = clampByte(r * m);
      g = clampByte(g * m);
      b = clampByte(b * m);
    } else if (odw > 0.004) {
      const m = 1 - odw * (1 - SMALL_DARK_MULT);
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
    if (baseData[o + 3] < 12) continue;
    const dr = variantData[o] - baseData[o];
    const dg = variantData[o + 1] - baseData[o + 1];
    const db = variantData[o + 2] - baseData[o + 2];
    const mag = (Math.abs(dr) + Math.abs(dg) + Math.abs(db)) / 3;
    if (mag < 1) continue;
    changed++;
    const dn = Math.hypot((i % width) - cx, ((i / width) | 0) - cy) / stoneRadius;
    if (dn <= 0.3) c60++;
    if (dn <= 0.175) c35++;
  }
  return {
    changedPercentCentral60: changed ? (c60 / changed) * 100 : 0,
    changedPercentCentral35: changed ? (c35 / changed) * 100 : 0,
  };
}

function pickCentralRegions(spec, trueCentralPool, nearCentralPool, used, avoidCentral) {
  const central = [];
  const pool = trueCentralPool.filter(
    (r) => r.distNorm <= TRUE_CENTRAL_CENTROID_MAX,
  );

  if (spec.centralMode === "subtle") {
    const medium =
      pickOne(pool, spec.central.medium, used, avoidCentral) ??
      pickOne(pool, spec.central.mediumFallback, used, avoidCentral);
    if (medium) central.push({ ...medium, role: "medium" });

    if (nearCentralPool.length) {
      const near = pickOne(
        nearCentralPool,
        (r) => r.distNorm >= 0.24 && r.distNorm <= 0.32,
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
) {
  const used = new Set();
  let centralDark = pickCentralRegions(
    spec,
    trueCentralPool,
    nearCentralPool,
    used,
    avoidCentral,
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
        (r) => step.pred(r) && r.distNorm > 0.34 && !used.has(r.id),
        step.limit ?? 2,
        used,
        avoidOuterDark,
      ),
    );
  }

  while (
    brightUse.filter((r) => r.size >= MIN_BRIGHT_MEDIUM_PX).length < 2 &&
    brightUse.length < MAX_BRIGHT_PER_PATTERN
  ) {
    const next = brightPool.find(
      (r) => !used.has(r.id) && r.size >= MIN_BRIGHT_MEDIUM_PX && r.distNorm > 0.34,
    );
    if (!next) break;
    brightUse.push(next);
    used.add(next.id);
  }

  while (brightUse.length < MIN_BRIGHT_PER_PATTERN) {
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
  while (outerDarkUse.length < MIN_OUTER_DARK_PER_PATTERN) {
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

  const brightFinal = brightUse.slice(0, MAX_BRIGHT_PER_PATTERN);
  let outerDarkFinal = outerDarkUse.slice(0, MAX_OUTER_DARK_PER_PATTERN);

  let growGuard = 0;
  while (growGuard++ < 36) {
    const { totalFrac } = measureCoverage(
      maps,
      brightFinal,
      centralDark,
      outerDarkFinal,
    );
    if (totalFrac >= TARGET_AREA_MIN && totalFrac <= TARGET_AREA_MAX) break;
    if (totalFrac >= TARGET_AREA_MAX) break;

    const addBright = brightFinal.length <= outerDarkFinal.length;
    const pool = addBright ? brightPool : darkPool;
    const list = addBright ? brightFinal : outerDarkFinal;
    const avoid = addBright ? avoidBright : avoidOuterDark;
    const max = addBright ? MAX_BRIGHT_PER_PATTERN : MAX_OUTER_DARK_PER_PATTERN;
    if (list.length >= max) {
      if (addBright && outerDarkFinal.length < MAX_OUTER_DARK_PER_PATTERN) continue;
      if (!addBright && brightFinal.length < MAX_BRIGHT_PER_PATTERN) continue;
      break;
    }
    const next = pool.find(
      (r) =>
        !used.has(r.id) &&
        !list.some((x) => x.id === r.id) &&
        !avoid.some((a) => a.id === r.id) &&
        (addBright
          ? r.distNorm > 0.32 && r.size >= MIN_BRIGHT_SMALL_PX
          : r.distNorm > 0.36 && r.size >= MIN_OUTER_DARK_SMALL_PX),
    );
    if (!next) break;
    list.push(next);
    used.add(next.id);
  }

  if (centralDark.length === 0 && trueCentralPool.length) {
    const fallback = pickOne(
      trueCentralPool,
      () => true,
      used,
      avoidCentral,
    );
    if (fallback) centralDark = [{ ...fallback, role: "large" }];
  }

  return { brightFinal, centralDark, outerDarkFinal };
}

function regionSummary(regions) {
  return regions.map((r) => ({
    id: r.id,
    role: r.role ?? "outer",
    sizeTier: sizeTier(r.size),
    pixels: r.size,
    quadrant: r.quadrant,
    distNorm: Number(r.distNorm.toFixed(3)),
    centralFraction35: Number((r.centralFraction35 ?? 0).toFixed(3)),
  }));
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Source not found: ${SRC}`);
    process.exit(1);
  }
  console.log(`Source: ${SRC_NAME}`);
  const src = loadPng(SRC);
  const maps = buildStoneMaps(src);
  const brightPool = findBrightRegions(maps);
  const darkPool = findDarkRegions(maps);
  const trueCentralPool = findTrueCentralRegions(maps);
  const nearCentralPool = findNearCentralRegions(maps);
  const patternKeys = ["a", "b", "c", "d"];
  const assigned = {};
  const usedCentralIds = new Set();
  let prevBright = [];
  let prevOuterDark = [];

  const manifest = {
    source: `public/diamond-tech-suite/diamonds/${SRC_NAME}`,
    canvas: "2560x2560",
    alphaPreserved: true,
    brightLuminanceRange: [BRIGHT_LUM_MIN, BRIGHT_LUM_MAX],
    darkLuminanceRange: [DARK_LUM_MIN, DARK_LUM_MAX],
    trueCentralLuminanceRange: [TRUE_CENTRAL_LUM_MIN, TRUE_CENTRAL_LUM_MAX],
    trueCentralCentroidRange: [TRUE_CENTRAL_CENTROID_MIN, TRUE_CENTRAL_CENTROID_MAX],
    trueCentralPixelRadius: TRUE_CENTRAL_PIXEL_RADIUS,
    brightLiftRgb: BRIGHT_LIFT,
    outerDarkLuminanceMultiplier: SMALL_DARK_MULT,
    trueCentralDarkLuminanceMultiplier: CENTRAL_DARK_MULT,
    regionExpandRadiusPx: REGION_EXPAND_RADIUS,
    centralRegionExpandRadiusPx: CENTRAL_EXPAND_RADIUS,
    girdleInsetPx: GIRDLE_INSET_PX,
    featherRadiusPx: FEATHER_RADIUS,
    brightRegionPool: brightPool.length,
    darkRegionPool: darkPool.length,
    trueCentralRegionPool: trueCentralPool.length,
    nearCentralRegionPool: nearCentralPool.length,
    patterns: {},
    consecutiveOverlap: {},
  };

  console.log(
    `True central pool: ${trueCentralPool.length} (${trueCentralPool
      .slice(0, 8)
      .map((r) => `${r.quadrant}:${r.size}px@d${r.distNorm.toFixed(2)}`)
      .join(", ")})`,
  );
  console.log(
    `Near central pool: ${nearCentralPool.length} (${nearCentralPool
      .slice(0, 6)
      .map((r) => `${r.quadrant}:${r.size}px@d${r.distNorm.toFixed(2)}`)
      .join(", ")})`,
  );

  for (const key of patternKeys) {
    const avoidCentral = [
      ...trueCentralPool.filter((r) => usedCentralIds.has(r.id)),
      ...nearCentralPool.filter((r) => usedCentralIds.has(r.id)),
    ];
    const avoidBright = prevBright;
    const avoidOuterDark = prevOuterDark;
    const patternIndex = patternKeys.indexOf(key);
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
      PATTERN_SPECS[key],
      rotatedBright,
      rotatedDark,
      trueCentralPool,
      nearCentralPool,
      avoidCentral,
      avoidBright,
      avoidOuterDark,
    );

    const { png, coverage } = renderVariant(
      maps,
      brightFinal,
      centralDark,
      outerDarkFinal,
    );

    const centralStats = measureChangedCentral(maps, maps.data, png.data);
    const fileName = `rbc-cad-scintillation-${key}.png`;
    writePng(path.join(OUT_DIR, fileName), png);
    assigned[key] = { brightFinal, centralDark, outerDarkFinal };

    manifest.patterns[key] = {
      file: `/diamond-tech-suite/diamonds/${fileName}`,
      centralMode: PATTERN_SPECS[key].centralMode,
      brightRegions: brightFinal.length,
      trueCentralRegions: centralDark.length,
      outerDarkRegions: outerDarkFinal.length,
      regionTiers: {
        bright: tierCounts(brightFinal),
        trueCentral: tierCounts(centralDark),
        outerDark: tierCounts(outerDarkFinal),
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
      },
      bright: regionSummary(brightFinal),
      trueCentral: regionSummary(centralDark),
      outerDark: regionSummary(outerDarkFinal),
    };

    console.log(
      `${fileName}: bright=${brightFinal.length} central=${centralDark.length} (${centralDark.map((r) => `${r.size}@d${r.distNorm.toFixed(2)}`).join("+")}) outer=${outerDarkFinal.length} total=${(coverage.totalFrac * 100).toFixed(1)}% c60=${centralStats.changedPercentCentral60.toFixed(1)}% c35=${centralStats.changedPercentCentral35.toFixed(1)}%`,
    );

    for (const r of centralDark) usedCentralIds.add(r.id);
    prevBright = brightFinal;
    prevOuterDark = outerDarkFinal;
  }

  for (let i = 1; i < patternKeys.length; i++) {
    const prev = patternKeys[i - 1];
    const curr = patternKeys[i];
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
        (regionOverlap(prevA.outerDarkFinal, currA.outerDarkFinal) * 100).toFixed(1),
      ),
      outerDarkPixelOverlapPercent: Number(
        (pixelOverlap(prevA.outerDarkFinal, currA.outerDarkFinal) * 100).toFixed(1),
      ),
    };
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`Manifest: ${MANIFEST_PATH}`);
}

main();
