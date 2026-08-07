import type { NextConfig } from "next";

/**
 * Dev-only cross-origin allowlist for `next dev`.
 * Ephemeral Cloudflare quick tunnels use *.trycloudflare.com — do not commit
 * specific tunnel hostnames; set DEV_TUNNEL_HOST if you need an extra host.
 */
const extraDevOrigins = [
  process.env.DEV_TUNNEL_HOST?.replace(/^https?:\/\//, "").replace(/\/$/, ""),
  ...(process.env.ALLOWED_DEV_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
].filter((v): v is string => !!v);

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.0.44",
    "localhost",
    "127.0.0.1",
    "*.trycloudflare.com",
    ...extraDevOrigins,
  ],
};

export default nextConfig;
