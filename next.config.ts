import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["tesseract.js", "@napi-rs/canvas", "pdfjs-dist"],
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
