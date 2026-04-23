/**
 * Next.js config: allow next/image for Google profile photos and Firebase Storage URLs.
 * Without remotePatterns, those hosts would break at runtime in production.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Proxy FastAPI routes through Next so the browser can use same-origin URLs
   * (`/rag/*`, `/agents/*`) when `NEXT_PUBLIC_API_URL` is unset — avoids CORS and
   * `localhost` vs `127.0.0.1` mismatches in dev.
   */
  async rewrites() {
    const target = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";
    return [
      { source: "/agents/:path*", destination: `${target}/agents/:path*` },
      { source: "/rag/:path*", destination: `${target}/rag/:path*` },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "lh4.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "lh5.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "lh6.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/**" },
    ],
  },
};

module.exports = nextConfig;
