import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the repo scaffold exactly as planned (Next 16 dev auto-generates AGENTS.md otherwise)
  agentRules: false,
  experimental: {
    // Middleware matches /api/admin/*, so non-GET bodies are cloned through
    // this cap (default 10MB, silent truncation beyond it — uploads would
    // fail with a corrupt multipart stream). 200mb matches the nginx
    // client_max_body_size in docs/DEPLOY.md §6; the per-file 25MB and
    // 60-image caps are enforced in lib/admin/limits.ts / lib/admin/store.ts.
    proxyClientMaxBodySize: "200mb",
  },
  images: {
    // Assets are served through /api/asset (on-demand sharp + disk cache),
    // so the custom loader just passes the assetUrl() output through.
    loader: "custom",
    loaderFile: "./lib/media/loader.ts",
  },
};

export default nextConfig;
