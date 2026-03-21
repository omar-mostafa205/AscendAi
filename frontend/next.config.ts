import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 100],
  },
  typescript : {
    ignoreBuildErrors : true,
  },
};

export default nextConfig;
