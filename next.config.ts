import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const PRODUCTION_API_ORIGIN = "https://api.croo.network";
const PRODUCTION_AI_BASE_URL = "https://api.croo.network/navigator/v1";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: appRoot,
  turbopack: {
    root: appRoot,
  },
  allowedDevOrigins: ["127.0.0.1"],
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || PRODUCTION_API_ORIGIN;
    const aiUrl =
      process.env.AI_SERVICE_URL ||
      process.env.NEXT_PUBLIC_CROO_AI_BASE_URL ||
      PRODUCTION_AI_BASE_URL;
    return [
      {
        source: "/backend/:path*",
        destination: `${backendUrl}/backend/:path*`,
      },
      {
        source: "/ai/:path*",
        destination: `${aiUrl.replace(/\/+$/, "")}/ai/:path*`,
      },
    ];
  },
};

export default nextConfig;
