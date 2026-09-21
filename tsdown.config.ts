import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    dom: "src/dom/index.ts",
    react: "src/react/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  target: "es2022",
  platform: "neutral",
  outputOptions: {
    // The hooks and components only work in a Client Component. Saying so once, on the entrypoint
    // (and not on the chunk it shares with /dom), is what Next.js and other React Server
    // Components bundlers read.
    banner: (chunk) => (chunk.name === "react" ? '"use client";' : ""),
  },
});
