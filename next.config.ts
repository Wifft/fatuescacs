import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        // Stockfish WASM build (copied by scripts/copy-engine.mjs). File names are not hashed,
        // so cache for a day instead of marking them immutable.
        source: "/engine/:file*.wasm",
        headers: [
          { key: "Content-Type", value: "application/wasm" },
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
      {
        // Opening table (scripts/build-openings.mts), ~85 KB gzip, loaded lazily.
        source: "/openings.json",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
      {
        source: "/engine/:file*.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ];
  },
};

export default nextConfig;
