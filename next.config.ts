import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 0, // disable router cache for all pages
      static: 30,
    },
  },
};

export default nextConfig;
