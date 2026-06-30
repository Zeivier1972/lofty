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
  webpack: (config, { isServer }) => {
    if (isServer) {
      // node-cron uses Node.js built-ins — keep it out of webpack bundling
      const existing = Array.isArray(config.externals) ? config.externals : config.externals ? [config.externals] : []
      config.externals = [...existing, "node-cron"]
    }
    return config
  },
}

module.exports = nextConfig
