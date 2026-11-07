import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets phones/tablets on the local network load dev assets; ignored in production.
  allowedDevOrigins: ["192.168.46.190"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
