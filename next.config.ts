import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    taint: true,
  },
  poweredByHeader: false,
};

export default nextConfig;
