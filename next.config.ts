import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow Tailscale network access in development (this machine + peers)
  allowedDevOrigins: ['100.73.73.93', '100.116.109.103', 'desktop-mqrar4o'],

  // Security headers for the main app
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },

  // Allow images from Supabase Storage
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // Reduce bundle size in production
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', '@radix-ui/react-dialog'],
  },
}

export default nextConfig
