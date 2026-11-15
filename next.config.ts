import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // AGENTS.md is maintained by hand; stop `next dev` from rewriting it.
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
