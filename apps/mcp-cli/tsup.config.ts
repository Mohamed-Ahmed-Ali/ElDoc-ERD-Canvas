import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  clean: true,
  noExternal: [/(.*)/], // Bundle all dependencies for pkg
});
