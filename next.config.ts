import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable Turbopack for better-sqlite3 compatibility
  turbopack: {
    // edge-tts 的 main 指向 TS 源码(index.ts)，Turbopack build 无法识别；
    // alias 到包内自带的编译产物 out/index.js
    resolveAlias: {
      "edge-tts": "./node_modules/edge-tts/out/index.js",
    },
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "edge-tts": "./node_modules/edge-tts/out/index.js",
    };
    if (!isServer) {
      // Don't bundle native modules on client side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "better-sqlite3": false,
        fs: false,
        path: false,
      };
    }
    return config;
  },
  // Mark better-sqlite3 as external (server-only)
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
