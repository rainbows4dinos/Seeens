import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The profile page edits in place now (#126); old Edit links land there.
  async redirects() {
    return [
      { source: "/connections/:id/edit", destination: "/connections/:id", permanent: false },
      // Add moved out of /connections (the quick view caught "new" as a
      // connection id and showed Nothing here).
      { source: "/connections/new", destination: "/add", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
