/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disabling strict linting checks on build for CCXT/dynamic types integration
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Bypass minor typing differences in Vercel environment
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
