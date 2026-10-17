import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the repo scaffold exactly as planned (Next 16 dev auto-generates AGENTS.md otherwise)
  agentRules: false,
};

export default nextConfig;
