import type { NextConfig } from "next";

/**
 * When the Vercel project Root Directory is unset, Git builds run from the
 * monorepo root (Expo). Root `vercel.json` sets SEREN_VERCEL_ROOT_STAGING=1 so
 * Next emits `.next` at the repo root where the Next builder expects it.
 * Once Root Directory is `apps/web`, omit that env and use the default `.next`.
 */
const nextConfig: NextConfig = {
  // Allow LAN access during local development (phone / other machines).
  allowedDevOrigins: ["192.168.0.44", "localhost"],
  ...(process.env.SEREN_VERCEL_ROOT_STAGING === "1"
    ? { distDir: "../../.next" }
    : {}),
};

export default nextConfig;
