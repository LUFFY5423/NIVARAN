/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  experimental: {
    // Server actions default to a 1MB body limit, which would reject photo uploads.
    // Vercel itself caps request bodies at ~4.5MB, so keep MAX_UPLOAD_BYTES at or below ~4MB there.
    serverActions: { bodySizeLimit: "6mb" },
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
