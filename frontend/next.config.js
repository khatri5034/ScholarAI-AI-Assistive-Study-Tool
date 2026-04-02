/**
 * Next.js config: allow next/image for Google profile photos and Firebase Storage URLs.
 * Without remotePatterns, those hosts would break at runtime in production.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
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
