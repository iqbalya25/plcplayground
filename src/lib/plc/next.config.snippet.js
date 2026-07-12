/**
 * next.config.snippet.js
 * Merge this `rewrites` block into your existing next.config.js / next.config.mjs.
 *
 * The browser only ever calls /api/plc/* on the Next.js origin;
 * Next.js forwards to the bridge server. No CORS configuration needed.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/plc/:path*",
        destination:
          process.env.PLC_BRIDGE_URL // e.g. "http://plc-server:4000" in Docker Compose
            ? `${process.env.PLC_BRIDGE_URL}/:path*`
            : "http://localhost:4000/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
