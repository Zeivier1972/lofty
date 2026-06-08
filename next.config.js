/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs", "rets-client", "node-expat"],
  },
  images: {
    domains: ["images.unsplash.com", "avatars.githubusercontent.com"],
  },
}

module.exports = nextConfig
