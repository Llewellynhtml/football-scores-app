import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.api-sports.io",
      },
    ],
    qualities: [50, 75],
    minimumCacheTTL: 86400,
  },
};

export default nextConfig;
