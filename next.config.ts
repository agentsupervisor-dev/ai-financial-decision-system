import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 0, // disable router cache for all pages
      static: 0,
    },
  },
};

export default nextConfig;
