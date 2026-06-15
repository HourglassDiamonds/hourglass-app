import type { NextConfig } from "next";

const pdfjsWorkerIncludes = [
  "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  "./node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["tesseract.js", "@napi-rs/canvas", "pdfjs-dist"],
  outputFileTracingIncludes: {
    "/api/diamond-intelligence/interpret": pdfjsWorkerIncludes,
    "/api/calibration-library/extract-file": pdfjsWorkerIncludes,
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
