import type { NextConfig } from "next";

const pdfjsWorkerIncludes = [
  "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  "./node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
];

/** GCAL Sarine diagram OCR — interpret route only (tessdata is ~10MB+). */
const interpretRouteTracingIncludes = [
  ...pdfjsWorkerIncludes,
  "./node_modules/@napi-rs/canvas/**/*",
  "./node_modules/@napi-rs/canvas-*/**/*",
  "./node_modules/pdfjs-dist/node_modules/@napi-rs/canvas/**/*",
  "./node_modules/pdfjs-dist/node_modules/@napi-rs/canvas-*/**/*",
  "./node_modules/tesseract.js/dist/**/*",
  "./node_modules/tesseract.js/src/**/*",
  "./node_modules/tesseract.js/package.json",
  "./node_modules/tesseract.js-core/**/*",
  "./node_modules/wasm-feature-detect/**/*",
  "./lib/calibration-library/tessdata/**/*",
];

/**
 * Local LAN QA only: allow phone browsers to load /_next/* in `next dev`.
 * Prefer ALLOWED_DEV_ORIGINS=host1,host2 or derive host from SHAPE_STUDIO_PUBLIC_ORIGIN.
 * Never hard-code a machine LAN IP here.
 */
function allowedDevOriginsFromEnv(): string[] | undefined {
  const explicit = process.env.ALLOWED_DEV_ORIGINS?.trim();
  if (explicit) {
    const list = explicit
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return list.length ? list : undefined;
  }

  const publicOrigin = process.env.SHAPE_STUDIO_PUBLIC_ORIGIN?.trim();
  if (!publicOrigin) return undefined;
  try {
    const host = new URL(publicOrigin).hostname;
    if (!host || host === "localhost" || host === "127.0.0.1") return undefined;
    return [host];
  } catch {
    return undefined;
  }
}

const allowedDevOrigins = allowedDevOriginsFromEnv();

const nextConfig: NextConfig = {
  ...(allowedDevOrigins ? { allowedDevOrigins } : {}),
  images: {
    qualities: [75, 95, 100],
  },
  transpilePackages: ["@mux/mux-player-react", "@mux/mux-player"],
  serverExternalPackages: ["tesseract.js", "@napi-rs/canvas", "pdfjs-dist"],
  outputFileTracingIncludes: {
    "/api/diamond-intelligence/interpret": interpretRouteTracingIncludes,
    "/api/calibration-library/extract-file": pdfjsWorkerIncludes,
  },
  outputFileTracingExcludes: {
    "/api/calibration-library/extract-file": [
      "./lib/calibration-library/tessdata/**",
      "./node_modules/@tesseract.js-data/**",
      "./node_modules/tesseract.js/src/worker-script/**",
    ],
  },
  async redirects() {
    return [
      {
        source: "/diamond-tech-suite",
        destination: "/diamond-studio",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
