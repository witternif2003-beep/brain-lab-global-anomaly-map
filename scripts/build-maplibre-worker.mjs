import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

mkdirSync("public", { recursive: true });
execSync(
  "npx esbuild node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs " +
    "--bundle --format=esm --target=es2022 --minify --legal-comments=none " +
    "--outfile=public/maplibre-gl-worker.mjs",
  { stdio: "inherit" }
);
console.log("MapLibre worker bundled successfully with target es2022.");
