/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs", "rets-client", "node-expat"],
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    domains: ["images.unsplash.com", "avatars.githubusercontent.com", "res.cloudinary.com", "i.imgur.com"],
  },
}

module.exports = nextConfig
