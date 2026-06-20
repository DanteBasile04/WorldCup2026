import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      // Wikimedia Commons — flag and emblem thumbnails
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
      // logos-world.net — team crest logos
      {
        protocol: "https",
        hostname: "logos-world.net",
      },
      // football-logos.cc — alternate team crests
      {
        protocol: "https",
        hostname: "assets.football-logos.cc",
      },
      // Supabase Storage — internal country media assets
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
