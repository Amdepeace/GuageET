import type { NextConfig } from "next";

// Static export for GitHub Pages. NEXT_PUBLIC_BASE_PATH is set by the deploy
// workflow to "/<repo>" (project pages are served under the repo name).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  webpack(config) {
    config.module.rules.push({ test: /\.geojson$/, type: "json" });
    return config;
  },
};

export default nextConfig;
