import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
