import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pg', 'cloudinary', 'better-auth']
};
export default nextConfig;
