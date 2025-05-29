/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  distDir: './dist', // Changes the build output directory to `./dist/`.

  // Configure webpack to handle Node.js built-in modules
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve 'fs' module on the client to prevent this error
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        path: false,
        os: false,
      };
    }
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },

  // Configure environment variables
  env: {
    NEXT_PUBLIC_PORTALS_BASE_URL: process.env.VITE_PORTALS_BASE_URL,
    NEXT_PUBLIC_PORTALS_API_KEY: process.env.VITE_PORTALS_API_KEY,
    NEXT_PUBLIC_BEBOP_API_KEY: process.env.VITE_BEBOP_API_KEY,
    NEXT_PUBLIC_OPENAI_API_KEY: process.env.VITE_OPENAI_API_KEY,
  },
};

export default nextConfig;
