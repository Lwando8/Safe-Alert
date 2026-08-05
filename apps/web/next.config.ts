import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow LAN access during local development (phone / other machines).
  allowedDevOrigins: ["192.168.0.44", "localhost", "127.0.0.1"],
};

export default nextConfig;
