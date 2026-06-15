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
  "./node_modules/tesseract.js/src/worker-script/**/*",
  "./node_modules/tesseract.js-core/**/*",
  "./lib/calibration-library/tessdata/**/*",
];

const nextConfig: NextConfig = {
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
