// Static production build for Vercel: bundles the React app into dist/
// (index.html + main.js + main.css + hashed creative images).
// No server code, no Muse runtime.
import tailwind from "bun-plugin-tailwind";
import { cp } from "node:fs/promises";

const result = await Bun.build({
  entrypoints: ["./src/main.tsx"],
  outdir: "./dist",
  target: "browser",
  minify: true,
  sourcemap: "none",
  publicPath: "./",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [tailwind],
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

await cp("./index.html", "./dist/index.html");
console.log("Built dist/:", result.outputs.map((o) => o.path).join(", "));
