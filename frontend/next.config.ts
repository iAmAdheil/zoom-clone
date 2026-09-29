import type { NextConfig } from "next";

// The browser only calls /api/* on the frontend origin. Next.js forwards these calls to the
// FastAPI backend, so the session cookie stays first-party (see docs/architecture.md).
// Next.js reads BACKEND_URL when it builds and starts the app.
const backendUrl = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
