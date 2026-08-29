/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "kbfxtdtvusisxvlmglzp.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/books",
          destination: "/api/books/create-9x",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
