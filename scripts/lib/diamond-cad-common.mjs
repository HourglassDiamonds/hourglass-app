/**
 * Shared helpers for Diamond Studio CAD asset generation.
 */
import fs from "fs";
import path from "path";
import { PNG } from "pngjs";
import sharp from "sharp";

export const ROOT = path.resolve(import.meta.dirname, "../..");
export const OUT_DIR = path.join(ROOT, "public/diamond-tech-suite/diamonds");
export const ALPHA_THRESHOLD = 10;
export const OPAQUE_ALPHA = 12;

export const SHAPE_SOURCES = {
  round: {
    shapeId: "round",
    /** Existing Round assets are kept as-is (canonical rbc-cad-* names). */
    sourceFile: null,
    originalFile: "rbc-cad.png",
    popFile: "rbc-cad-pop.png",
    switcherFile: "rbc-cad-switcher.png",
    variantPrefix: "rbc-cad-scintillation",
    legacyFile: "round.png",
    profile: "brilliant",
    shadow: "round",
    regenerate: false,
  },
  oval: {
    shapeId: "oval",
    sourceFile: "HRG-OTH-R-96044-Oval 3 carat diamond.png",
    originalFile: "oval-cad.png",
    popFile: "oval-cad-pop.png",
    switcherFile: "oval-cad-switcher.png",
    variantPrefix: "oval-cad-scintillation",
    legacyFile: "oval.png",
    profile: "brilliant",
    shadow: "elongated",
    regenerate: true,
  },
  cushion: {
    shapeId: "cushion",
    sourceFile: "HRG-OTH-R-96045-Cushion 3 carat diamond.png",
    originalFile: "cushion-cad.png",
    popFile: "cushion-cad-pop.png",
    switcherFile: "cushion-cad-switcher.png",
    variantPrefix: "cushion-cad-scintillation",
    legacyFile: "cushion.png",
    profile: "brilliant",
    shadow: "square",
    regenerate: true,
  },
  radiant: {
    shapeId: "radiant",
    sourceFile: "HRG-OTH-R-96046-Radiant 3 carat diamond.png",
    originalFile: "radiant-cad.png",
    popFile: "radiant-cad-pop.png",
    switcherFile: "radiant-cad-switcher.png",
    variantPrefix: "radiant-cad-scintillation",
    legacyFile: "radiant.png",
    profile: "brilliant",
    shadow: "elongated",
    regenerate: true,
  },
  emerald: {
    shapeId: "emerald",
    sourceFile: "HRG-OTH-R-96047-Emerald 3 carat diamond.png",
    originalFile: "emerald-cad.png",
    popFile: "emerald-cad-pop.png",
    switcherFile: "emerald-cad-switcher.png",
    variantPrefix: "emerald-cad-scintillation",
    legacyFile: "emerald.png",
    profile: "step",
    shadow: "elongated",
    regenerate: true,
  },
  asscher: {
    shapeId: "asscher",
    sourceFile: "HRG-OTH-R-96048-Asscher 3 carat diamond.png",
    originalFile: "asscher-cad.png",
    popFile: "asscher-cad-pop.png",
    switcherFile: "asscher-cad-switcher.png",
    variantPrefix: "asscher-cad-scintillation",
    legacyFile: "asscher.png",
    profile: "step",
    shadow: "square",
    regenerate: true,
  },
  pear: {
    shapeId: "pear",
    sourceFile: "HRG-OTH-R-96049-Pear 3 carat diamond.png",
    originalFile: "pear-cad.png",
    popFile: "pear-cad-pop.png",
    switcherFile: "pear-cad-switcher.png",
    variantPrefix: "pear-cad-scintillation",
    legacyFile: "pear.png",
    profile: "brilliant",
    shadow: "elongated",
    regenerate: true,
  },
  marquise: {
    shapeId: "marquise",
    sourceFile: "HRG-OTH-R-96050-Marquise 3 carat diamond.png",
    originalFile: "marquise-cad.png",
    popFile: "marquise-cad-pop.png",
    switcherFile: "marquise-cad-switcher.png",
    variantPrefix: "marquise-cad-scintillation",
    legacyFile: "marquise.png",
    profile: "brilliant",
    shadow: "elongated",
    regenerate: true,
  },
  princess: {
    shapeId: "princess",
    sourceFile: "HRG-OTH-R-96051-Princess 3 carat diamond.png",
    originalFile: "princess-cad.png",
    popFile: "princess-cad-pop.png",
    switcherFile: "princess-cad-switcher.png",
    variantPrefix: "princess-cad-scintillation",
    legacyFile: "princess.png",
    profile: "brilliant",
    shadow: "square",
    regenerate: true,
  },
};

export function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

export function loadPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

export function writePng(filePath, png) {
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

export function probeVisibleBounds(png, alphaThreshold = ALPHA_THRESHOLD) {
  const { width, height, data } = png;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a <= alphaThreshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      sumX += x;
      sumY += y;
      count++;
    }
  }

  if (count === 0) {
    throw new Error("No visible alpha pixels found");
  }

  const boundsW = maxX - minX + 1;
  const boundsH = maxY - minY + 1;
  return {
    canvasWidth: width,
    canvasHeight: height,
    minX,
    minY,
    maxX,
    maxY,
    boundsW,
    boundsH,
    centroidX: sumX / count,
    centroidY: sumY / count,
    opaqueCount: count,
    visibleFillRatio: boundsW / width,
    visibleFillRatioH: boundsH / height,
    centerX: sumX / count / width,
    centerY: sumY / count / height,
  };
}

export function applyLuminanceToRgb(r, g, b, newL) {
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

export function buildEdgeDist(width, height, opaque) {
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

export function boxBlur(src, width, height, radius) {
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

/** Conservative facet-definition enhancement (same curve as Round CAD pop). */
export function enhanceFacetDefinition(srcPng) {
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
  const SHARPEN = {
    radiusPx: 2,
    amount: 0.28,
    threshold: 6,
    edgeProtectPx: 5,
  };

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

  const { width, height, data } = srcPng;
  const n = width * height;
  const opaque = new Uint8Array(n);
  const lum = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (data[o + 3] < OPAQUE_ALPHA) continue;
    opaque[i] = 1;
    lum[i] = luminance(data[o], data[o + 1], data[o + 2]);
  }

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
    if (a < OPAQUE_ALPHA) {
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

  return out;
}

export async function generateSwitcher(srcPath, outPath) {
  const OUT_SIZE = 512;
  const PAD_PX = 36;
  const trimmedBuf = await sharp(srcPath).trim({ threshold: 12 }).png().toBuffer();
  const meta = await sharp(trimmedBuf).metadata();
  const pad = Math.min(
    PAD_PX,
    Math.round(Math.min(meta.width ?? OUT_SIZE, meta.height ?? OUT_SIZE) * 0.04),
  );

  const extendedBuf = await sharp(trimmedBuf)
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp(extendedBuf)
    .resize(OUT_SIZE, OUT_SIZE, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outPath);

  return {
    outSize: OUT_SIZE,
    pad,
    trimmedWidth: meta.width,
    trimmedHeight: meta.height,
  };
}

export function publicDiamondPath(fileName) {
  return `/diamond-tech-suite/diamonds/${fileName}`;
}
