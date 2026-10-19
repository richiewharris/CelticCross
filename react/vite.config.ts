import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import { createReadStream, existsSync } from "node:fs";
import { resolve } from "node:path";

// The built site lives in /next/ and uses the repo's shared /images/ folder (../images/...).
// In dev and preview the site is served from /, so serve that folder at /images/ too.
const repoImages = (): Plugin => {
  const dir = resolve(__dirname, "../images");
  const mw = (req: { url?: string }, res: NodeJS.WritableStream & { setHeader(k: string, v: string): void }, next: () => void) => {
    const m = req.url?.match(/^\/images\/([\w.-]+)$/);
    const file = m && resolve(dir, m[1]);
    if (!file || !existsSync(file)) return next();
    res.setHeader("Content-Type", file.endsWith(".png") ? "image/png" : file.endsWith(".svg") ? "image/svg+xml" : "image/jpeg");
    createReadStream(file).pipe(res);
  };
  return { name: "repo-images", configureServer: s => { s.middlewares.use(mw as never); }, configurePreviewServer: s => { s.middlewares.use(mw as never); } };
};

export default defineConfig({
  base: "./",
  plugins: [react(), repoImages()],
  worker: { format: "es" },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
