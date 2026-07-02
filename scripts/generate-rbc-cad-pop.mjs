/**
 * Generate facet-definition enhanced Round CAD base from rbc-cad.png.
 *
 *   node scripts/generate-rbc-cad-pop.mjs
 */
import fs from "fs";
import path from "path";
import { PNG } from "pngjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "public/diamond-tech-suite/diamonds/rbc-cad.png");
const OUT = path.join(ROOT, "public/diamond-tech-suite/diamonds/rbc-cad-pop.png");

/** Piecewise luminance multipliers / lifts (luminance-only, hue preserved). */
const LUM_CURVE = {
  darkMax: 80,
  darkMultLo: 0.955,
  darkMultHi: 0.965,
  midtoneMax: 155,
  midtoneMultLo: 0.965,
  midtoneMultHi: 0.97,
  upperMidMax: 220,
  upperMidContrast: 1.042,
  upperMidCenter: 187.5,
  upperMidLowBias: 0.992,
  highlightLiftLo: 2,
  highlightLiftHi: 4,
  highlightMax: 252,
  preserveMin: 253,
};

/** Alpha-aware luminance unsharp mask. */
const SHARPEN = {
  radiusPx: 2,
  amount: 0.28,
  threshold: 6,
  edgeProtectPx: 5,
};

function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function curveLuminance(L) {
  if (L >= LUM_CURVE.preserveMin) return L;

  if (L <= LUM_CURVE.darkMax) {
    const t = L / LUM_CURVE.darkMax;
    const mult =
      LUM_CURVE.darkMultLo + t * (LUM_CURVE.darkMultHi - LUM_CURVE.darkMultLo);
    return L * mult;
  }

  if (L <= LUM_CURVE.midtoneMax) {
    const span = LUM_CURVE.midtoneMax - LUM_CURVE.darkMax;
    const t = (L - LUM_CURVE.darkMax) / span;
    const mult =
      LUM_CURVE.midtoneMultLo +
      t * (LUM_CURVE.midtoneMultHi - LUM_CURVE.midtoneMultLo);
    return L * mult;
  }

  if (L <= LUM_CURVE.upperMidMax) {
    const mid = LUM_CURVE.upperMidCenter;
    let out = mid + (L - mid) * LUM_CURVE.upperMidContrast;
    if (L < mid) out *= LUM_CURVE.upperMidLowBias;
    return Math.max(0, Math.min(LUM_CURVE.highlightMax, out));
  }

  if (L <= LUM_CURVE.highlightMax) {
    const span = LUM_CURVE.highlightMax - LUM_CURVE.upperMidMax;
    const t = (L - LUM_CURVE.upperMidMax) / span;
    const lift =
      LUM_CURVE.highlightLiftLo +
      t * (LUM_CURVE.highlightLiftHi - LUM_CURVE.highlightLiftLo);
    return Math.min(254, L + lift);
  }

  return L;
}

function applyLuminanceToRgb(r, g, b, newL) {
  const oldL = luminance(r, g, b);
  if (oldL < 0.001) return [r, g, b];
  const scale = newL / oldL;
  let nr = r * scale;
  let ng = g * scale;
  let nb = b * scale;
  const peak = Math.max(nr, ng, nb);
  if (peak > 254) {
    const c = 254 / peak;
    nr *= c;
    ng *= c;
    nb *= c;
  }
  return [clampByte(nr), clampByte(ng), clampByte(nb)];
}

function buildEdgeDist(width, height, opaque) {
  const n = width * height;
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
    if (x > 0) {
      const ni = i - 1;
      if (opaque[ni] && edgeDist[ni] > d) {
        edgeDist[ni] = d;
        queue.push(ni);
      }
    }
    if (x < width - 1) {
      const ni = i + 1;
      if (opaque[ni] && edgeDist[ni] > d) {
        edgeDist[ni] = d;
        queue.push(ni);
      }
    }
    if (y > 0) {
      const ni = i - width;
      if (opaque[ni] && edgeDist[ni] > d) {
        edgeDist[ni] = d;
        queue.push(ni);
      }
    }
    if (y < height - 1) {
      const ni = i + width;
      if (opaque[ni] && edgeDist[ni] > d) {
        edgeDist[ni] = d;
        queue.push(ni);
      }
    }
  }
  return edgeDist;
}

function boxBlur(src, width, height, radius) {
  if (radius < 1) return src.slice();
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const r = radius | 0;
  const div = r * 2 + 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) {
        sum += src[y * width + Math.min(width - 1, Math.max(0, x + k))];
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

function histogramLabel(lumArr, opaque) {
  const buckets = { "0-80": 0, "81-155": 0, "156-220": 0, "221-252": 0, "253+": 0 };
  for (let i = 0; i < lumArr.length; i++) {
    if (!opaque[i]) continue;
    const L = lumArr[i];
    if (L <= 80) buckets["0-80"]++;
    else if (L <= 155) buckets["81-155"]++;
    else if (L <= 220) buckets["156-220"]++;
    else if (L <= 252) buckets["221-252"]++;
    else buckets["253+"]++;
  }
  return buckets;
}

function main() {
  const png = PNG.sync.read(fs.readFileSync(SRC));
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

  console.log("Source histogram:", histogramLabel(lum, opaque));

  const curved = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (!opaque[i]) continue;
    curved[i] = curveLuminance(lum[i]);
  }

  const blurred = boxBlur(curved, width, height, SHARPEN.radiusPx);
  const edgeDist = buildEdgeDist(width, height, opaque);
  const sharpened = new Float32Array(curved);

  for (let i = 0; i < n; i++) {
    if (!opaque[i]) continue;
    const detail = curved[i] - blurred[i];
    if (Math.abs(detail) <= SHARPEN.threshold) continue;
    const edgeWeight = Math.min(1, edgeDist[i] / SHARPEN.edgeProtectPx);
    if (edgeWeight <= 0) continue;
    sharpened[i] = curved[i] + SHARPEN.amount * detail * edgeWeight;
  }

  const out = new PNG({ width, height });
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const a = data[o + 3];
    out.data[o + 3] = a;
    if (a < 12) {
      out.data[o] = data[o];
      out.data[o + 1] = data[o + 1];
      out.data[o + 2] = data[o + 2];
      continue;
    }
    const [r, g, b] = applyLuminanceToRgb(
      data[o],
      data[o + 1],
      data[o + 2],
      sharpened[i],
    );
    out.data[o] = r;
    out.data[o + 1] = g;
    out.data[o + 2] = b;
  }

  fs.writeFileSync(OUT, PNG.sync.write(out));
  console.log(`Wrote ${OUT}`);
  console.log("Luminance curve:", LUM_CURVE);
  console.log("Sharpen:", SHARPEN);
  console.log(
    "Alpha-edge protection: yes (sharpen weight scales 0→1 over",
    SHARPEN.edgeProtectPx,
    "px from alpha boundary)",
  );

  const outLum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (!opaque[i]) continue;
    const o = i * 4;
    outLum[i] = luminance(out.data[o], out.data[o + 1], out.data[o + 2]);
  }
  console.log("Output histogram:", histogramLabel(outLum, opaque));
}

main();
