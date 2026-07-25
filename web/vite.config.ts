import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    assetsInlineLimit: 0,
  },
  server: {
    fs: {
      allow: [".."],
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "server/**/*.test.ts"],
  },
});
