import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable transpilation of monorepo packages
  transpilePackages: [
    "@polydiction/db",
    "@polydiction/scoring",
    "@polydiction/types",
  ],
};

export default nextConfig;
