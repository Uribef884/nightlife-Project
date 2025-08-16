import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Bucket-specific host (keeps optimization fast)
      { protocol: "https", hostname: "nightlife-files.s3.amazonaws.com" },

      // Generic S3 endpoint for buckets like s3.amazonaws.com/nightlife/...
      { protocol: "https", hostname: "s3.amazonaws.com", pathname: "/nightlife/**" },

      // If you have other buckets, add them here:
      // { protocol: "https", hostname: "YOUR-BUCKET.s3.amazonaws.com" },
      // { protocol: "https", hostname: "s3.amazonaws.com", pathname: "/YOUR-BUCKET/**" },
    ],
  },
};

export default nextConfig;
