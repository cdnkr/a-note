import { resolve } from "node:path";
import { defineConfig } from "vite";

const scriptNames = [
  "background",
  "brand",
  "lib",
  "layout",
  "widget",
  "content",
];

export default defineConfig({
  appType: "custom",
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: true,
    sourcemap: false,
    rollupOptions: {
      input: Object.fromEntries(
        scriptNames.map((name) => [
          name,
          resolve(import.meta.dirname, `src/${name}.js`),
        ]),
      ),
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
});
