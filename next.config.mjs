/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/plc/:path*",
        destination: process.env.PLC_BRIDGE_URL
          ? `${process.env.PLC_BRIDGE_URL}/:path*`
          : "http://localhost:4000/:path*",
      },
    ];
  },
};

export default nextConfig;
