/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
  images: {
    domains: ["images.unsplash.com", "avatars.githubusercontent.com"],
  },
}

module.exports = nextConfig
