import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // What's New (#216) reads its Markdown at runtime; ship it with the server.
  outputFileTracingIncludes: { "/**": ["./content/changelog.md"] },
  // Launch hardening: no framing (clickjacking on Sign In), no MIME sniffing,
  // referrers trimmed to the origin off-site, HTTPS remembered, and no camera,
  // mic, or location for any page. The photo copier reads files, not the camera.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        ],
      },
    ];
  },
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
