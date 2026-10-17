import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the repo scaffold exactly as planned (Next 16 dev auto-generates AGENTS.md otherwise)
  agentRules: false,
  images: {
    // Assets are served through /api/asset (on-demand sharp + disk cache),
    // so the custom loader just passes the assetUrl() output through.
    loader: "custom",
    loaderFile: "./lib/media/loader.ts",
  },
};

export default nextConfig;
