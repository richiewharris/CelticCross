import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import { createReadStream, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

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

// The build's commit, stamped into match records so a recorded match is replayed by the rules it was played under.
const build = (() => { try { return execSync("git rev-parse --short HEAD", { cwd: __dirname }).toString().trim(); } catch { return "unknown"; } })();

export default defineConfig({
  base: "./",
  define: { __BUILD__: JSON.stringify(build) },
  plugins: [react(), repoImages()],
  worker: { format: "es" },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
